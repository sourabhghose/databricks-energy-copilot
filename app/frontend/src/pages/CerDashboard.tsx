import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Leaf, Zap, DollarSign, Sun, Wind, Droplets, Flame, Factory } from 'lucide-react'
import { api } from '../api/client'
import type { CerDashboard, LretRecord, SresRecord, CerAccreditedStation } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtM(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4 shadow-sm">
      <div className={`p-2.5 rounded-lg ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
        {sub && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fuel Source Badge
// ---------------------------------------------------------------------------
const fuelBadgeMap: Record<string, { label: string; cls: string }> = {
  WIND:       { label: 'Wind',       cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200' },
  SOLAR_PV:   { label: 'Solar PV',   cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  HYDRO:      { label: 'Hydro',      cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  BROWN_COAL: { label: 'Brown Coal', cls: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  GAS:        { label: 'Gas',        cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
}

function FuelBadge({ fuel }: { fuel: string }) {
  const def = fuelBadgeMap[fuel] ?? { label: fuel, cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${def.cls}`}>
      {fuel === 'WIND' && <Wind size={10} />}
      {fuel === 'SOLAR_PV' && <Sun size={10} />}
      {fuel === 'HYDRO' && <Droplets size={10} />}
      {fuel === 'BROWN_COAL' && <Factory size={10} />}
      {fuel === 'GAS' && <Flame size={10} />}
      {def.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'REGISTERED'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// LRET Chart — ComposedChart: renewable % line + LGC price bars
// ---------------------------------------------------------------------------
function LretChart({ records }: { records: LretRecord[] }) {
  const data = records.map(r => ({
    year: r.year,
    renewable_pct: r.renewable_power_percentage,
    lgc_price: r.laret_price_aud,
    acquittal: Math.round(r.liable_entity_acquittal_gwh / 1000),
    target: Math.round(r.lret_target_gwh / 1000),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
        LRET — Renewable % &amp; LGC Price History
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Green line: Renewable Power Percentage | Amber bars: LGC spot price (A$/cert)
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" domain={[0, 50]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'renewable_pct') return [`${value.toFixed(1)}%`, 'Renewable %']
              if (name === 'lgc_price') return [`$${value.toFixed(2)}`, 'LGC Price']
              return [value, name]
            }}
          />
          <Legend formatter={(value) => value === 'renewable_pct' ? 'Renewable %' : 'LGC Price (A$/cert)'} />
          <Bar yAxisId="right" dataKey="lgc_price" fill="#f59e0b" opacity={0.7} radius={[3, 3, 0, 0]} />
          <Line yAxisId="left" type="monotone" dataKey="renewable_pct" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SRES Chart — BarChart: capacity installed + STC price line
// ---------------------------------------------------------------------------
function SresChart({ records }: { records: SresRecord[] }) {
  const data = records.map(r => ({
    year: r.year,
    capacity_mw: r.total_capacity_installed_mw,
    stc_price: r.stc_price_aud,
    systems: Math.round(r.sth_systems_installed / 1000),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
        SRES — Small-scale Solar Installations &amp; STC Price
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Blue bars: Total capacity installed (MW) | Orange line: STC price (A$/cert)
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tickFormatter={v => `${v}`} tick={{ fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
          <YAxis yAxisId="right" orientation="right" domain={[20, 45]} tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'capacity_mw') return [`${fmt(value, 0)} MW`, 'Capacity Installed']
              if (name === 'stc_price') return [`$${value.toFixed(2)}/cert`, 'STC Price']
              return [value, name]
            }}
          />
          <Legend formatter={(value) => value === 'capacity_mw' ? 'Capacity Installed (MW)' : 'STC Price (A$/cert)'} />
          <Bar yAxisId="left" dataKey="capacity_mw" fill="#3b82f6" opacity={0.75} radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="stc_price" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accredited Stations Table
// ---------------------------------------------------------------------------
function StationsTable({ stations }: { stations: CerAccreditedStation[] }) {
  const [fuelFilter, setFuelFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')

  const fuelOptions = Array.from(new Set(stations.map(s => s.fuel_source))).sort()
  const stateOptions = Array.from(new Set(stations.map(s => s.state))).sort()

  const filtered = stations.filter(s => {
    if (fuelFilter && s.fuel_source !== fuelFilter) return false
    if (stateFilter && s.state !== stateFilter) return false
    return true
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            CER Accredited Power Stations
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {filtered.length} of {stations.length} stations shown
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={fuelFilter}
            onChange={e => setFuelFilter(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Fuel Sources</option>
            {fuelOptions.map(f => (
              <option key={f} value={f}>{fuelBadgeMap[f]?.label ?? f}</option>
            ))}
          </select>
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All States</option>
            {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Station Name</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Developer</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">State</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Fuel Source</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Capacity (MW)</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">LGC Created YTD</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">LGC Price $/cert</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, idx) => (
              <tr
                key={s.station_id}
                className={`border-t border-gray-100 dark:border-gray-700/50 ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'} hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors`}
              >
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                  {s.station_name}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.developer}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {s.state}
                  </span>
                </td>
                <td className="px-4 py-3"><FuelBadge fuel={s.fuel_source} /></td>
                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  {fmt(s.capacity_mw, 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  {fmtM(s.lgc_created_ytd)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  ${s.lgc_price_aud.toFixed(2)}
                </td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  No stations match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LRET Records Detail Table
// ---------------------------------------------------------------------------
function LretTable({ records }: { records: LretRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          LRET Annual Acquittal Records
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Liable entity acquittal vs target | LGC certificate activity
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Year</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Target (GWh)</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Acquittal (GWh)</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Shortfall (GWh)</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Renewable %</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">LGC Created</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">LGC Price</th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Stations</th>
            </tr>
          </thead>
          <tbody>
            {[...records].reverse().map((r, idx) => (
              <tr
                key={r.year}
                className={`border-t border-gray-100 dark:border-gray-700/50 ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'} hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors`}
              >
                <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{r.year}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  {fmt(r.lret_target_gwh, 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  {fmt(r.liable_entity_acquittal_gwh, 0)}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${r.lret_shortfall_gwh > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400'}`}>
                  {r.lret_shortfall_gwh > 0 ? fmt(r.lret_shortfall_gwh, 0) : 'Met'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  {r.renewable_power_percentage.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  {fmtM(r.laret_certificates_created)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                  ${r.laret_price_aud.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                  {r.num_accredited_power_stations}
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
// Context Note
// ---------------------------------------------------------------------------
function ContextNote() {
  return (
    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 text-xs text-green-800 dark:text-green-300 leading-relaxed">
      <span className="font-semibold">About Australia's Renewable Energy Target (RET): </span>
      The RET is split into two schemes — the{' '}
      <span className="font-semibold">Large-scale Renewable Energy Target (LRET)</span>, requiring
      liable entities to source 33,000 GWh/year of large-scale renewable energy by 2020, and the{' '}
      <span className="font-semibold">Small-scale Renewable Energy Scheme (SRES)</span>, supporting
      residential rooftop solar and solar water heaters. Large-scale Generation Certificates (LGCs)
      are created when eligible renewable electricity is generated at accredited power stations —
      one LGC per MWh. Small-scale Technology Certificates (STCs) support small systems and are
      traded at the STC Clearing House at a fixed price of A$40/cert.
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function CerDashboard() {
  const [dashboard, setDashboard] = useState<CerDashboard | null>(null)
  const [lretRecords, setLretRecords] = useState<LretRecord[]>([])
  const [stations, setStations] = useState<CerAccreditedStation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      api.getCerDashboard(),
      api.getLretRecords(),
      api.getCerStations(),
    ])
      .then(([dash, lret, stns]) => {
        setDashboard(dash)
        setLretRecords(lret)
        setStations(stns)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load CER data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading CER & RET data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-5 text-sm text-red-700 dark:text-red-400">
          <strong>Error:</strong> {error}
        </div>
      </div>
    )
  }

  const lretTarget = dashboard?.lret_target_2030_gwh ?? 33000
  const renewablePct = dashboard?.current_year_renewable_pct ?? 0
  const stcPrice = dashboard?.stc_clearing_house_price_aud ?? 40
  const lgcSpot = dashboard?.laret_spot_price_aud ?? 0
  const totalStations = dashboard?.total_accredited_stations ?? 0
  const sresRecords: SresRecord[] = dashboard?.sres_records ?? []

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/40">
            <Leaf className="text-green-600 dark:text-green-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Clean Energy Regulator &amp; RET Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <Zap size={10} />
                LRET / SRES
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {totalStations} accredited stations | Updated {dashboard?.timestamp ?? '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="LRET Target 2030"
          value={`${fmt(lretTarget, 0)} GWh`}
          sub="Large-scale 33,000 GWh/yr target"
          icon={<Zap size={18} className="text-green-600 dark:text-green-400" />}
          accent="bg-green-100 dark:bg-green-900/40"
        />
        <KpiCard
          label="Current Year Renewable %"
          value={`${renewablePct.toFixed(1)}%`}
          sub="Share of generation from renewables"
          icon={<Leaf size={18} className="text-emerald-600 dark:text-emerald-400" />}
          accent="bg-emerald-100 dark:bg-emerald-900/40"
        />
        <KpiCard
          label="STC Clearing House Price"
          value={`$${stcPrice.toFixed(2)}`}
          sub="Fixed A$40/cert via CER clearing house"
          icon={<Sun size={18} className="text-yellow-600 dark:text-yellow-400" />}
          accent="bg-yellow-100 dark:bg-yellow-900/40"
        />
        <KpiCard
          label="LGC Spot Price"
          value={`$${lgcSpot.toFixed(2)}/cert`}
          sub="Large-scale Generation Certificate"
          icon={<DollarSign size={18} className="text-blue-600 dark:text-blue-400" />}
          accent="bg-blue-100 dark:bg-blue-900/40"
        />
      </div>

      {/* Context Note */}
      <ContextNote />

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LretChart records={lretRecords} />
        <SresChart records={sresRecords} />
      </div>

      {/* Stations Table */}
      <StationsTable stations={stations} />

      {/* LRET Records Detail Table */}
      <LretTable records={lretRecords} />
    </div>
  )
}
