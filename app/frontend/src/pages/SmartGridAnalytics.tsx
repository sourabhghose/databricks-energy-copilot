import { useEffect, useState } from 'react'
import { Cpu } from 'lucide-react'
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
import {
  api,
  SmartGridDashboard,
  DoeRecord,
  DermsRecord,
} from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

function doeBadge(doe_type: string) {
  const colors: Record<string, string> = {
    STATIC:      'bg-gray-600 text-gray-100',
    DYNAMIC:     'bg-blue-700 text-blue-100',
    COORDINATED: 'bg-green-700 text-green-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[doe_type] ?? 'bg-gray-700 text-gray-100'}`}>
      {doe_type}
    </span>
  )
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    TRIAL:       'bg-yellow-600 text-yellow-100',
    ROLLOUT:     'bg-blue-700 text-blue-100',
    OPERATIONAL: 'bg-green-700 text-green-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[status] ?? 'bg-gray-700 text-gray-100'}`}>
      {status}
    </span>
  )
}

function interopBadge(standard: string) {
  const colors: Record<string, string> = {
    CSIP_AUS:    'bg-indigo-700 text-indigo-100',
    OPENADR:     'bg-purple-700 text-purple-100',
    IEEE2030_5:  'bg-cyan-700 text-cyan-100',
    PROPRIETARY: 'bg-orange-700 text-orange-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[standard] ?? 'bg-gray-700 text-gray-100'}`}>
      {standard.replace('_', '-')}
    </span>
  )
}

function KpiCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
    </div>
  )
}

const ALL_STATES = ['ALL', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS']

// ── Component ─────────────────────────────────────────────────────────────────

export default function SmartGridAnalytics() {
  const [dash, setDash] = useState<SmartGridDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stateFilter, setStateFilter] = useState('ALL')

  useEffect(() => {
    api.getSmartGridDashboard()
      .then(setDash)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading smart grid data...
      </div>
    )
  }

  if (error || !dash) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  const filteredDoe: DoeRecord[] =
    stateFilter === 'ALL'
      ? dash.doe_programs
      : dash.doe_programs.filter(p => p.state === stateFilter)

  const chartData = filteredDoe.map(p => ({
    name: p.program_name.replace(/^(Ausgrid|Endeavour|Essential|Jemena|Powercor|CitiPower|Energex|Ergon|SAPN|Western Power|TasNetworks)\s+/, '').slice(0, 22),
    customers: p.customers_enrolled,
    solar_scaled: Math.round(p.peak_solar_managed_mw * 100),
  }))

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Cpu size={28} className="text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">
            Smart Grid Innovation &amp; Grid Modernisation Analytics
          </h1>
          <p className="text-sm text-gray-400">
            Dynamic Operating Envelopes · DERMS · AMI Adoption · Virtual Network Operators · Grid Automation
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total DOE Customers"
          value={dash.total_doe_customers.toLocaleString()}
        />
        <KpiCard
          label="Total DERMS Assets"
          value={dash.total_derms_assets.toLocaleString()}
        />
        <KpiCard
          label="Total Controllable"
          value={dash.total_controllable_mw.toLocaleString()}
          unit="MW"
        />
        <KpiCard
          label="National AMI Penetration"
          value={dash.national_ami_penetration_pct.toFixed(1)}
          unit="%"
        />
      </div>

      {/* DOE Program Bar Chart */}
      <div className="bg-gray-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">DOE Programs — Customers &amp; Solar Managed</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_STATES.map(s => (
              <button
                key={s}
                onClick={() => setStateFilter(s)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  stateFilter === s
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="text-gray-500 text-sm">No programs for selected state.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(value: number, name: string) =>
                  name === 'solar_scaled'
                    ? [`${(value / 100).toFixed(1)} MW`, 'Peak Solar Managed']
                    : [value.toLocaleString(), 'Customers Enrolled']
                }
              />
              <Legend
                wrapperStyle={{ color: '#9ca3af', paddingTop: '8px' }}
                formatter={(value) =>
                  value === 'solar_scaled' ? 'Peak Solar Managed (×100 scaled)' : 'Customers Enrolled'
                }
              />
              <Bar dataKey="customers" fill="#3b82f6" name="customers" radius={[3, 3, 0, 0]} />
              <Bar dataKey="solar_scaled" fill="#22c55e" name="solar_scaled" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* DOE Programs Table */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-3">Dynamic Operating Envelope Programs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Program</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">DNSP</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">State</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Type</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Customers</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Avg Export kW</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Peak Solar MW</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Cost $M</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {dash.doe_programs.map(p => (
                <tr key={p.record_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 px-3 text-gray-200 font-medium">{p.program_name}</td>
                  <td className="py-2 px-3 text-gray-300">{p.dnsp}</td>
                  <td className="py-2 px-3 text-gray-300">{p.state}</td>
                  <td className="py-2 px-3">{doeBadge(p.doe_type)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{p.customers_enrolled.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{p.avg_export_limit_kw.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{p.peak_solar_managed_mw.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{p.implementation_cost_m_aud.toFixed(1)}</td>
                  <td className="py-2 px-3">{statusBadge(p.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DERMS Table */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-3">DERMS Systems</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">System</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">DNSP</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">State</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">DER Types</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Assets</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Ctrl MW</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Events/yr</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Standard</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Year</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">OPEX $M/yr</th>
              </tr>
            </thead>
            <tbody>
              {dash.derms_systems.map((d: DermsRecord) => (
                <tr key={d.record_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 px-3 text-gray-200 font-medium">{d.system_name}</td>
                  <td className="py-2 px-3 text-gray-300">{d.dnsp}</td>
                  <td className="py-2 px-3 text-gray-300">{d.state}</td>
                  <td className="py-2 px-3 text-gray-300 text-xs">{d.der_types_managed.join(', ')}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{d.registered_assets.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{d.controllable_mw.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{d.coordination_events_yr.toLocaleString()}</td>
                  <td className="py-2 px-3">{interopBadge(d.interoperability_standard)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{d.rollout_year}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{d.opex_m_aud_pa.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AMI Adoption Summary */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-3">AMI Adoption — Latest Quarter (2025-Q2)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">State</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">DNSP</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Smart Meters</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Penetration %</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Interval Data %</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Remote Disc. %</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">DR Enrolled</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Qtrly CAPEX $M</th>
              </tr>
            </thead>
            <tbody>
              {dash.ami_adoption
                .filter(r => r.quarter === '2025-Q2')
                .map(r => (
                  <tr key={r.record_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="py-2 px-3 text-gray-200 font-medium">{r.state}</td>
                    <td className="py-2 px-3 text-gray-300">{r.dnsp}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{r.smart_meters_installed.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-semibold ${r.penetration_pct >= 90 ? 'text-green-400' : r.penetration_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {r.penetration_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-300">{r.interval_data_enabled_pct.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right text-gray-300">{r.remote_disconnect_enabled_pct.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right text-gray-300">{r.demand_response_enrolled.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{r.ami_capex_m_aud.toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
