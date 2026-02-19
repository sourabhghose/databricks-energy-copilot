import { useEffect, useState } from 'react'
import { Gauge, Zap, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import type { FcasMarketDashboard, FcasServicePrice, FcasProvider, FcasTrapRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const PIE_COLOURS = ['#6366f1', '#f59e0b']

function riskBadge(risk: string) {
  const map: Record<string, string> = {
    NONE:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    LOW:    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    HIGH:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${map[risk] ?? map.NONE}`}>
      {risk === 'HIGH' || risk === 'MEDIUM' ? <AlertTriangle size={11} /> : null}
      {risk}
    </span>
  )
}

function directionBadge(direction: string) {
  const cls =
    direction === 'RAISE'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {direction}
    </span>
  )
}

function typeBadge(type: string) {
  const cls =
    type === 'REGULATION'
      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {type}
    </span>
  )
}

function trapBadge(trapType: string) {
  const cls =
    trapType === 'CAUSER_PAYS'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {trapType.replace('_', ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  colour: string
}

function KpiCard({ label, value, sub, icon, colour }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colour}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 8-Service price table row colour helper
// ---------------------------------------------------------------------------

function serviceRowCls(direction: string) {
  return direction === 'RAISE'
    ? 'hover:bg-green-50 dark:hover:bg-green-900/10'
    : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FcasMarket() {
  const [dashboard, setDashboard] = useState<FcasMarketDashboard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    api.getFcasMarket()
      .then(data => { setDashboard(data); setLoading(false) })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        <Gauge size={28} className="animate-spin mr-3" />
        <span className="text-sm">Loading FCAS market data…</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <AlertTriangle size={24} className="mr-2" />
        <span className="text-sm">{error ?? 'Failed to load FCAS data'}</span>
      </div>
    )
  }

  const pieSeries = [
    { name: 'Regulation', value: dashboard.regulation_cost_aud },
    { name: 'Contingency', value: dashboard.contingency_cost_aud },
  ]

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Gauge size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">FCAS Market &amp; Ancillary Services</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              All 8 FCAS services — regulation &amp; contingency clearing prices, provider analysis, constraint traps
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Shortfall risk:</span>
          {riskBadge(dashboard.shortfall_risk)}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total FCAS Cost Today"
          value={`$${dashboard.total_fcas_cost_today_aud.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub="AUD estimated"
          icon={<DollarSign size={18} className="text-indigo-600 dark:text-indigo-400" />}
          colour="bg-indigo-100 dark:bg-indigo-900/30"
        />
        <KpiCard
          label="Regulation Cost"
          value={`$${dashboard.regulation_cost_aud.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub="R5RE + L5RE"
          icon={<TrendingUp size={18} className="text-purple-600 dark:text-purple-400" />}
          colour="bg-purple-100 dark:bg-purple-900/30"
        />
        <KpiCard
          label="Contingency Cost"
          value={`$${dashboard.contingency_cost_aud.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub="6s / 60s / 5m services"
          icon={<Zap size={18} className="text-amber-600 dark:text-amber-400" />}
          colour="bg-amber-100 dark:bg-amber-900/30"
        />
        <KpiCard
          label="Total Enabled MW"
          value={`${dashboard.total_enabled_mw.toLocaleString()} MW`}
          sub="Raise + Lower across all providers"
          icon={<Gauge size={18} className="text-green-600 dark:text-green-400" />}
          colour="bg-green-100 dark:bg-green-900/30"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 8-Service Price Table + Cost PieChart (side by side on large screens)*/}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Service table — takes 2/3 width on XL */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">FCAS Service Clearing Prices</h2>
            <span className="text-xs text-gray-400">8 services — current dispatch interval</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/40 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Service</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Direction</th>
                  <th className="px-4 py-2 text-right">Price $/MW</th>
                  <th className="px-4 py-2 text-right">Volume MW</th>
                  <th className="px-4 py-2 text-right">Req MW</th>
                  <th className="px-4 py-2 text-right">Util %</th>
                  <th className="px-4 py-2 text-right">Max Today</th>
                  <th className="px-4 py-2 text-right">Min Today</th>
                  <th className="px-4 py-2 text-left">Main Provider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {dashboard.services.map((s: FcasServicePrice) => (
                  <tr key={s.service} className={`transition-colors ${serviceRowCls(s.direction)}`}>
                    <td className="px-4 py-2 font-mono font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {s.service}
                      <span className="block text-xs font-normal text-gray-400 font-sans">{s.service_name}</span>
                    </td>
                    <td className="px-4 py-2">{typeBadge(s.type)}</td>
                    <td className="px-4 py-2">{directionBadge(s.direction)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                      ${s.clearing_price_aud_mw.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                      {s.volume_mw.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                      {s.requirement_mw.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-semibold ${s.utilisation_pct >= 99 ? 'text-red-600 dark:text-red-400' : s.utilisation_pct >= 95 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                        {s.utilisation_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 text-xs">${s.max_clearing_today.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 text-xs">${s.min_clearing_today.toFixed(2)}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-xs whitespace-nowrap">{s.main_provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost distribution pie */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">FCAS Cost Distribution</h2>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieSeries}
                  cx="50%"
                  cy="45%"
                  outerRadius={80}
                  innerRadius={40}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieSeries.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLOURS[idx % PIE_COLOURS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) =>
                    [`$${val.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 'Cost AUD']
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {pieSeries.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PIE_COLOURS[idx] }} />
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ${item.value.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FCAS Provider Table                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">FCAS Providers</h2>
          <span className="text-xs text-gray-400">{dashboard.providers.length} registered providers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/40 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-2 text-left">Station</th>
                <th className="px-4 py-2 text-left">DUID</th>
                <th className="px-4 py-2 text-left">Fuel</th>
                <th className="px-4 py-2 text-left">Region</th>
                <th className="px-4 py-2 text-left">Services Enabled</th>
                <th className="px-4 py-2 text-right">Raise MW</th>
                <th className="px-4 py-2 text-right">Lower MW</th>
                <th className="px-4 py-2 text-right">Regulation MW</th>
                <th className="px-4 py-2 text-right">Contingency MW</th>
                <th className="px-4 py-2 text-right">Revenue Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboard.providers.map((p: FcasProvider) => (
                <tr key={p.duid} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">{p.station_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">{p.duid}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{p.fuel_type}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">
                      {p.region}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.services_enabled.map(svc => (
                        <span
                          key={svc}
                          className="inline-block px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-mono"
                        >
                          {svc}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-green-700 dark:text-green-400 font-medium">{p.raise_mw > 0 ? `${p.raise_mw} MW` : '—'}</td>
                  <td className="px-4 py-2 text-right text-blue-700 dark:text-blue-400 font-medium">{p.lower_mw > 0 ? `${p.lower_mw} MW` : '—'}</td>
                  <td className="px-4 py-2 text-right text-purple-700 dark:text-purple-400">{p.regulation_mw > 0 ? `${p.regulation_mw} MW` : '—'}</td>
                  <td className="px-4 py-2 text-right text-amber-700 dark:text-amber-400">{p.contingency_mw > 0 ? `${p.contingency_mw} MW` : '—'}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    ${p.revenue_today_aud.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Constraint / Trap Records Table                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            FCAS Constraint &amp; Trap Records
          </h2>
          <span className="text-xs text-gray-400">{dashboard.trap_records.length} active traps</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/40 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-2 text-left">DUID</th>
                <th className="px-4 py-2 text-left">Station</th>
                <th className="px-4 py-2 text-left">Region</th>
                <th className="px-4 py-2 text-left">Service</th>
                <th className="px-4 py-2 text-left">Trap Type</th>
                <th className="px-4 py-2 text-left">Constraint ID</th>
                <th className="px-4 py-2 text-right">MW Limited</th>
                <th className="px-4 py-2 text-right">Revenue Foregone</th>
                <th className="px-4 py-2 text-right">Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboard.trap_records.map((t: FcasTrapRecord, idx: number) => (
                <tr key={idx} className="hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{t.duid}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white font-medium whitespace-nowrap">{t.station_name}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">
                      {t.region}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-block px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-mono">
                      {t.service}
                    </span>
                  </td>
                  <td className="px-4 py-2">{trapBadge(t.trap_type)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{t.constraint_id}</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-600 dark:text-red-400">{t.mw_limited} MW</td>
                  <td className="px-4 py-2 text-right font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                    ${t.revenue_foregone_est.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-gray-500 dark:text-gray-400">{t.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Regional Requirements                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Regional FCAS Requirements</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {dashboard.regional_requirement.map((r) => (
            <div
              key={r.region}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-3"
            >
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300 font-mono mb-2">{r.region}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-green-600 dark:text-green-400 font-medium">Raise</span>
                  <span className="text-gray-700 dark:text-gray-300 font-semibold">{r.raise_req_mw} MW</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">Lower</span>
                  <span className="text-gray-700 dark:text-gray-300 font-semibold">{r.lower_req_mw} MW</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
