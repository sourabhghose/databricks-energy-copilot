import { useState, useEffect } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Radio, AlertTriangle, AlertOctagon, Info, CheckCircle, Activity } from 'lucide-react'
import { getRealtimeOpsDashboard, RealtimeOpsDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour constants
// ---------------------------------------------------------------------------

const FUEL_COLORS: Record<string, string> = {
  coal:    '#374151',
  gas:     '#F59E0B',
  wind:    '#3B82F6',
  solar:   '#EAB308',
  hydro:   '#06B6D4',
  battery: '#8B5CF6',
  other:   '#9CA3AF',
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { bg: 'bg-red-950/60',    border: 'border-red-600',    text: 'text-red-400',    icon: AlertOctagon  },
  WARNING:  { bg: 'bg-amber-950/60',  border: 'border-amber-500',  text: 'text-amber-400',  icon: AlertTriangle },
  INFO:     { bg: 'bg-blue-950/60',   border: 'border-blue-600',   text: 'text-blue-400',   icon: Info          },
}

const CATEGORY_BADGE: Record<string, string> = {
  PRICE:       'bg-rose-800 text-rose-100',
  FREQUENCY:   'bg-violet-800 text-violet-100',
  RESERVE:     'bg-amber-800 text-amber-100',
  CONSTRAINT:  'bg-orange-800 text-orange-100',
  MARKET:      'bg-cyan-800 text-cyan-100',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priceColour(price: number): string {
  if (price < 100)  return 'text-emerald-400'
  if (price < 500)  return 'text-amber-400'
  return 'text-red-400'
}

function priceBg(price: number): string {
  if (price < 100)  return 'border-emerald-700/50 bg-emerald-950/30'
  if (price < 500)  return 'border-amber-600/50 bg-amber-950/30'
  return 'border-red-600/50 bg-red-950/40'
}

function freqColour(hz: number): string {
  const dev = Math.abs(hz - 50)
  if (dev < 0.015) return 'text-emerald-400'
  if (dev < 0.05)  return 'text-amber-400'
  return 'text-red-400'
}

function fmtMW(mw: number): string {
  return mw >= 1000 ? `${(mw / 1000).toFixed(2)} GW` : `${mw.toFixed(0)} MW`
}

function fmtPrice(p: number): string {
  return `$${p.toFixed(2)}`
}

function fmtTs(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Australia/Sydney',
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RegionTileProps {
  r: RealtimeOpsDashboard['regions'][0]
}

function RegionTile({ r }: RegionTileProps) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${priceBg(r.spot_price_aud_mwh)}`}>
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-white tracking-widest">{r.region}</span>
        <span className={`text-xl font-black ${priceColour(r.spot_price_aud_mwh)}`}>
          {fmtPrice(r.spot_price_aud_mwh)}
          <span className="text-xs font-normal text-gray-400 ml-1">/MWh</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>Demand</span>
        <span className="text-right text-gray-200">{fmtMW(r.total_demand_mw)}</span>
        <span>Generation</span>
        <span className="text-right text-gray-200">{fmtMW(r.generation_mw)}</span>
        <span>Rooftop PV</span>
        <span className="text-right text-gray-200">{fmtMW(r.rooftop_solar_mw)}</span>
        <span>Reserve</span>
        <span className="text-right text-gray-200">{fmtMW(r.reserve_mw)}</span>
      </div>
      <div className="flex items-center justify-between border-t border-gray-700/50 pt-2 text-xs">
        <span className="text-gray-400">Frequency</span>
        <span className={`font-mono font-bold text-sm ${freqColour(r.frequency_hz)}`}>
          {r.frequency_hz.toFixed(3)} Hz
        </span>
      </div>
    </div>
  )
}

interface GenMixChartProps {
  region: string
  mix: Record<string, number>
}

function GenMixChart({ region, mix }: GenMixChartProps) {
  const data = Object.entries(mix)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      <div className="text-xs font-semibold text-gray-300 mb-2 tracking-widest">{region}</div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={FUEL_COLORS[entry.name] ?? '#9CA3AF'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(v: number, name: string) => [
              `${fmtMW(v)} (${((v / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1 text-xs text-gray-400">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: FUEL_COLORS[d.name] ?? '#9CA3AF' }}
            />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function RealtimeOperationsDashboard() {
  const [data, setData] = useState<RealtimeOpsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    let cancelled = false

    const load = () => {
      getRealtimeOpsDashboard()
        .then((d) => {
          if (!cancelled) {
            setData(d)
            setLastRefresh(new Date())
            setError(null)
          }
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    load()
    const interval = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Build FCAS bar chart data
  const fcasChartData = data
    ? data.fcas.map((f) => ({
        service: f.service.replace('_', ' '),
        cleared: f.cleared_mw,
        requirement: f.requirement_mw,
        price: f.clearing_price_aud_mw,
      }))
    : []

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-6">

      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio size={24} className="text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-white">NEM Real-Time Operational Overview</h1>
            <p className="text-xs text-gray-500">Live dispatch, generation mix, interconnectors, FCAS & system frequency</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950 border border-emerald-700">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-300 tracking-widest">LIVE</span>
          </div>
          <div className="text-xs text-gray-500 text-right">
            <div>Last updated</div>
            <div className="text-gray-300 font-mono">
              {lastRefresh.toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
            </div>
          </div>
        </div>
      </div>

      {/* ---- Loading / Error ---- */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-500 gap-3">
          <Activity size={20} className="animate-pulse" />
          <span>Loading operational data…</span>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-700 bg-red-950/40 p-4 text-red-300 text-sm">
          Failed to load dashboard: {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* ---- Regional Price Tiles ---- */}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Regional Snapshots
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {data.regions.map((r) => (
                <RegionTile key={r.region} r={r} />
              ))}
            </div>
          </section>

          {/* ---- Generation Mix ---- */}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Generation Mix by Region
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {data.regions.map((r) => (
                <GenMixChart key={r.region} region={r.region} mix={r.generation_mix} />
              ))}
            </div>
          </section>

          {/* ---- Interconnector Flows ---- */}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Interconnector Flows
            </h2>
            <div className="rounded-xl border border-gray-700 bg-gray-900/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/60">
                    <th className="text-left px-4 py-3 text-gray-400 font-semibold">Interconnector</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-semibold">Direction</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-semibold">Flow</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-semibold">Capacity</th>
                    <th className="px-4 py-3 text-gray-400 font-semibold">Utilisation</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-semibold">Binding</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-semibold">MLF Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {data.interconnectors.map((ic) => (
                    <tr
                      key={ic.interconnector}
                      className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-cyan-300">{ic.interconnector}</td>
                      <td className="px-4 py-3 text-gray-300">
                        <span className="text-gray-500">{ic.from_region}</span>
                        <span className="mx-2 text-emerald-400 font-bold">→</span>
                        <span className="text-gray-200">{ic.to_region}</span>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${ic.flow_mw >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {ic.flow_mw >= 0 ? '+' : ''}{fmtMW(Math.abs(ic.flow_mw))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{fmtMW(ic.capacity_mw)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                ic.utilisation_pct > 80
                                  ? 'bg-red-500'
                                  : ic.utilisation_pct > 50
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(ic.utilisation_pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-10 text-right">
                            {ic.utilisation_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ic.binding ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-900 text-red-300 border border-red-700">
                            BINDING
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-400 text-xs">
                        {(ic.marginal_loss * 100).toFixed(3)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ---- FCAS Markets ---- */}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
              FCAS Market Snapshot
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* FCAS Grid Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.fcas.map((f) => {
                  const isRaise = f.service.startsWith('RAISE')
                  return (
                    <div
                      key={f.service}
                      className={`rounded-lg border p-3 flex flex-col gap-1 ${
                        isRaise
                          ? 'border-emerald-700/50 bg-emerald-950/30'
                          : 'border-blue-700/50 bg-blue-950/30'
                      }`}
                    >
                      <div className={`text-xs font-bold tracking-wider ${isRaise ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {f.service.replace('_', ' ')}
                      </div>
                      <div className="text-base font-black text-white">
                        {fmtMW(f.cleared_mw)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Req: {fmtMW(f.requirement_mw)}
                      </div>
                      <div className="text-xs font-semibold text-amber-300">
                        ${f.clearing_price_aud_mw.toFixed(2)}/MW
                      </div>
                      <div className={`text-xs ${f.surplus_pct > 10 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        +{f.surplus_pct.toFixed(1)}% surplus
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* FCAS Bar Chart */}
              <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                <div className="text-xs font-semibold text-gray-400 mb-3">Cleared vs Requirement (MW)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={fcasChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis
                      dataKey="service"
                      tick={{ fill: '#9ca3af', fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#e5e7eb' }}
                      formatter={(v: number, name: string) => [
                        `${v.toFixed(0)} MW`,
                        name === 'cleared' ? 'Cleared' : 'Requirement',
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}
                    />
                    <Bar dataKey="requirement" fill="#374151" radius={[2, 2, 0, 0]} name="Requirement" />
                    <Bar dataKey="cleared" fill="#10b981" radius={[2, 2, 0, 0]} name="Cleared" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ---- System Alerts ---- */}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
              System Alerts
              <span className="ml-2 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                {data.alerts.filter((a) => !a.acknowledged).length} unacknowledged
              </span>
            </h2>
            <div className="space-y-2">
              {data.alerts.map((alert) => {
                const styles = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.INFO
                const Icon = styles.icon
                return (
                  <div
                    key={alert.alert_id}
                    className={`rounded-xl border flex items-start gap-3 px-4 py-3 ${styles.bg} ${styles.border} ${alert.acknowledged ? 'opacity-60' : ''}`}
                  >
                    <Icon size={18} className={`${styles.text} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider ${styles.text}`}>
                          {alert.severity}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${CATEGORY_BADGE[alert.category] ?? 'bg-gray-700 text-gray-200'}`}>
                          {alert.category}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-800 text-gray-300 border border-gray-700">
                          {alert.region}
                        </span>
                        {alert.acknowledged && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle size={12} />
                            Acknowledged
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-200">{alert.message}</p>
                    </div>
                    <div className="text-xs text-gray-500 font-mono shrink-0 text-right">
                      <div>{fmtTs(alert.timestamp)}</div>
                      <div className="text-gray-600 text-xs">{alert.alert_id}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ---- Footer ---- */}
          <footer className="pt-2 border-t border-gray-800 flex items-center justify-between text-xs text-gray-600">
            <span>NEM data sourced from AEMO NEMWEB — auto-refreshes every 30 s</span>
            <span className="font-mono">Dashboard timestamp: {fmtTs(data.timestamp)}</span>
          </footer>
        </>
      )}
    </div>
  )
}
