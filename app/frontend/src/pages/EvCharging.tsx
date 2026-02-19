import { useEffect, useState } from 'react'
import { Zap, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api, EvDashboard, EvCharger, EvGridImpact } from '../api/client'

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

function ChargerTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    AC_L2: 'bg-green-900 text-green-300 border border-green-700',
    DC_FAST: 'bg-blue-900 text-blue-300 border border-blue-700',
    ULTRA_RAPID: 'bg-purple-900 text-purple-300 border border-purple-700',
  }
  const cls = styles[type] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EvCharging() {
  const [dashboard, setDashboard] = useState<EvDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [stateFilter, setStateFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  useEffect(() => {
    api
      .getEvDashboard()
      .then(d => {
        setDashboard(d)
        setLoading(false)
      })
      .catch(err => {
        setError(err?.message ?? 'Failed to load EV dashboard')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <span className="animate-pulse text-lg">Loading EV data…</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-red-400">
        <AlertTriangle size={20} />
        <span>{error ?? 'No data available'}</span>
      </div>
    )
  }

  // Derived
  const states = Array.from(new Set(dashboard.chargers.map(c => c.state))).sort()
  const chargerTypes = ['AC_L2', 'DC_FAST', 'ULTRA_RAPID']

  const filteredChargers: EvCharger[] = dashboard.chargers.filter(c => {
    const stateOk = stateFilter === 'ALL' || c.state === stateFilter
    const typeOk = typeFilter === 'ALL' || c.charger_type === typeFilter
    return stateOk && typeOk
  })

  // Grid impact chart data
  const gridChartData = dashboard.grid_impacts.map((g: EvGridImpact) => ({
    state: g.state,
    'Peak Load (MW)': g.charging_load_mw_peak,
    'Offpeak Load (MW)': g.charging_load_mw_offpeak,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
          <Zap className="text-amber-400" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            EV Charging Infrastructure &amp; Grid Impact
          </h1>
          <p className="text-sm text-gray-400">
            Australia-wide EV charging network rollout, grid impact assessment, managed charging
            programs and smart charging economics
          </p>
        </div>
        <span className="ml-auto text-xs text-gray-500">
          Updated: {dashboard.timestamp}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Total EV Vehicles"
          value={dashboard.total_ev_vehicles.toLocaleString()}
          sub="Registered nationally"
        />
        <KpiCard
          label="Total Chargers"
          value={dashboard.total_chargers}
          sub="Across all states"
        />
        <KpiCard
          label="Total Charging Capacity"
          value={`${dashboard.total_charging_capacity_mw.toFixed(2)} MW`}
          sub="Combined connector capacity"
        />
        <KpiCard
          label="Avg Utilisation"
          value={`${dashboard.avg_utilisation_pct.toFixed(1)}%`}
          sub={`Managed charging: ${dashboard.managed_charging_pct}%`}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Grid Impact Bar Chart                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
        <h2 className="mb-4 text-base font-semibold text-white">
          EV Charging Grid Impact by State — Peak vs Offpeak Load (MW)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={gridChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Peak Load (MW)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Offpeak Load (MW)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Chargers Table                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-white flex-1">Charging Infrastructure</h2>

          {/* State filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">State</label>
            <select
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 border border-gray-600 focus:outline-none"
            >
              <option value="ALL">All States</option>
              {states.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Type</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 border border-gray-600 focus:outline-none"
            >
              <option value="ALL">All Types</option>
              {chargerTypes.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <span className="text-xs text-gray-500">{filteredChargers.length} charger(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs uppercase tracking-wider text-gray-400">
                <th className="pb-2 text-left">Site</th>
                <th className="pb-2 text-left">Operator</th>
                <th className="pb-2 text-left">State</th>
                <th className="pb-2 text-left">Type</th>
                <th className="pb-2 text-right">Power kW</th>
                <th className="pb-2 text-right">Connectors</th>
                <th className="pb-2 text-right">Utilisation %</th>
                <th className="pb-2 text-right">Sessions/day</th>
                <th className="pb-2 text-right">Revenue $/day</th>
                <th className="pb-2 text-center">Managed</th>
                <th className="pb-2 text-center">Grid Upgrade</th>
              </tr>
            </thead>
            <tbody>
              {filteredChargers.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-gray-500">
                    No chargers match the selected filters.
                  </td>
                </tr>
              )}
              {filteredChargers.map((c: EvCharger) => (
                <tr
                  key={c.charger_id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-white">{c.site_name}</span>
                    <span className="ml-1.5 text-xs text-gray-500">({c.installation_year})</span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-300">{c.operator}</td>
                  <td className="py-2.5 pr-4">
                    <span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300">
                      {c.state}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <ChargerTypeBadge type={c.charger_type} />
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-200">{c.power_kw}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-200">{c.num_connectors}</td>
                  <td className="py-2.5 pr-4 text-right">
                    <span
                      className={
                        c.utilisation_pct >= 70
                          ? 'text-green-400'
                          : c.utilisation_pct >= 50
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }
                    >
                      {c.utilisation_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-200">
                    {c.sessions_per_day.toFixed(1)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-200">
                    ${c.revenue_aud_per_day.toFixed(2)}
                  </td>
                  <td className="py-2.5 text-center">
                    {c.managed_charging ? (
                      <CheckCircle size={16} className="inline text-green-400" />
                    ) : (
                      <XCircle size={16} className="inline text-gray-600" />
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    {c.grid_upgrade_required ? (
                      <span className="inline-block rounded bg-red-900 px-2 py-0.5 text-xs font-semibold text-red-300 border border-red-700">
                        Required
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Grid Impact Table                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 space-y-4">
        <h2 className="text-base font-semibold text-white">Grid Impact by State</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs uppercase tracking-wider text-gray-400">
                <th className="pb-2 text-left">State</th>
                <th className="pb-2 text-right">EVs Registered</th>
                <th className="pb-2 text-right">Peak Load MW</th>
                <th className="pb-2 text-right">Offpeak Load MW</th>
                <th className="pb-2 text-right">Managed Charging %</th>
                <th className="pb-2 text-right">Grid Upgrade $M</th>
                <th className="pb-2 text-right">Renewable Charging %</th>
                <th className="pb-2 text-right">V2G Capable</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.grid_impacts.map((g: EvGridImpact) => (
                <tr
                  key={g.state}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-2.5 pr-4">
                    <span className="font-semibold text-white">{g.state}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-200">
                    {g.ev_vehicles_registered.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-blue-400">
                    {g.charging_load_mw_peak.toFixed(1)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-amber-400">
                    {g.charging_load_mw_offpeak.toFixed(1)}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span
                      className={
                        g.managed_charging_participation_pct >= 50
                          ? 'text-green-400'
                          : g.managed_charging_participation_pct >= 35
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }
                    >
                      {g.managed_charging_participation_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-200">
                    ${g.grid_upgrade_cost_m_aud.toFixed(1)}M
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span
                      className={
                        g.renewable_charging_pct >= 60
                          ? 'text-green-400'
                          : g.renewable_charging_pct >= 35
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }
                    >
                      {g.renewable_charging_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-gray-200">
                    {g.v2g_capable_vehicles.toLocaleString()}
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
