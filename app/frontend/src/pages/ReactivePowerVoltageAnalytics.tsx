import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  PSRPDashboard,
  getReactivePowerVoltageDashboard,
} from '../api/client'

const STATUS_COLOUR: Record<string, string> = {
  Normal:          '#22c55e',
  High:            '#f59e0b',
  Low:             '#f59e0b',
  'Critical High': '#ef4444',
  'Critical Low':  '#ef4444',
}

const REGION_COLOURS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  QLD: '#f59e0b',
  SA:  '#f87171',
  TAS: '#a78bfa',
}

export default function ReactivePowerVoltageAnalytics() {
  const [data, setData]       = useState<PSRPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getReactivePowerVoltageDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-400">
      <Zap className="animate-pulse text-amber-400 mr-2" size={20} />
      Loading Reactive Power &amp; Voltage data…
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
      Error: {error}
    </div>
  )

  if (!data) return null

  const { summary, voltage_profiles, reactive_devices, reactive_flows, voltage_events, constraints, generator_capabilities } = data

  // ── KPI cards ────────────────────────────────────────────────────────────
  const kpis = [
    {
      label: 'Voltage Issues Count',
      value: String(summary.regions_with_voltage_issues ?? '—'),
      sub:   'Regions with abnormal voltage',
      colour: 'text-red-400',
    },
    {
      label: 'Total Reactive Support',
      value: `${Number(summary.total_reactive_support_mvar).toLocaleString(undefined, { maximumFractionDigits: 0 })} MVAr`,
      sub:   'Combined cap + ind rating',
      colour: 'text-amber-400',
    },
    {
      label: 'Avg System Power Factor',
      value: Number(summary.avg_system_pf).toFixed(4),
      sub:   'Across all regions & periods',
      colour: 'text-emerald-400',
    },
    {
      label: 'Annual Reactive Cost',
      value: `$${Number(summary.annual_reactive_cost_m).toFixed(1)} M`,
      sub:   'Constraint shadow price costs',
      colour: 'text-blue-400',
    },
  ]

  // ── Voltage profile chart data (bus × status) ─────────────────────────
  const profileChartData = voltage_profiles.map(p => ({
    name:       p.bus_name.replace(/ \d+kV$/i, ''),
    voltage_pu: p.voltage_pu,
    status:     p.voltage_status,
    fill:       STATUS_COLOUR[p.voltage_status] ?? '#94a3b8',
    region:     p.region,
    date:       p.measurement_date,
  }))

  // ── Reactive device capacity by technology (aggregated) ───────────────
  const techAgg: Record<string, { cap: number; ind: number }> = {}
  reactive_devices.forEach(d => {
    if (!techAgg[d.technology]) techAgg[d.technology] = { cap: 0, ind: 0 }
    techAgg[d.technology].cap += d.rating_mvar_cap
    techAgg[d.technology].ind += d.rating_mvar_ind
  })
  const deviceChartData = Object.entries(techAgg).map(([tech, v]) => ({
    technology:  tech,
    Capacitive:  Math.round(v.cap),
    Inductive:   Math.round(v.ind),
  }))

  // ── Reactive flow by region over time ────────────────────────────────
  const flowByDate: Record<string, Record<string, number>> = {}
  reactive_flows.forEach(f => {
    if (!flowByDate[f.date]) flowByDate[f.date] = { date: f.date as unknown as number }
    flowByDate[f.date][f.region] = Math.round(f.reactive_generation_mvar)
  })
  const flowChartData = Object.values(flowByDate)

  // ── Constraint shadow prices ──────────────────────────────────────────
  const constraintChartData = constraints.map(c => ({
    name:        c.constraint_name.length > 22 ? c.constraint_name.slice(0, 22) + '…' : c.constraint_name,
    shadow_price: c.avg_shadow_price_dolpermvar,
    annual_cost:  c.annual_cost_m,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Reactive Power &amp; Voltage Management</h1>
          <p className="text-sm text-gray-400">NEM-wide VAr support, voltage profiles and constraint analytics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.colour}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Voltage Profile Chart */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Voltage Profile by Bus (per unit)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={profileChartData} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
            <YAxis domain={[0.85, 1.15]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(val: number, _name: string, entry: { payload?: { status?: string; region?: string } }) => [
                val.toFixed(4),
                `${entry.payload?.status ?? ''} (${entry.payload?.region ?? ''})`,
              ]}
            />
            <Bar dataKey="voltage_pu" name="Voltage (pu)">
              {profileChartData.map((entry, i) => (
                <rect key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(STATUS_COLOUR).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Reactive Device Capacity */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Reactive Device Capacity by Technology (MVAr)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={deviceChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px', paddingTop: '8px' }} />
            <Bar dataKey="Capacitive" fill="#34d399" name="Capacitive (MVAr)" />
            <Bar dataKey="Inductive"  fill="#f87171" name="Inductive (MVAr)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Reactive Power Flow Over Time */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">System Reactive Generation by Region Over Time (MVAr)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={flowChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
            {Object.keys(REGION_COLOURS).map(r => (
              <Line key={r} type="monotone" dataKey={r} stroke={REGION_COLOURS[r]} dot={false} strokeWidth={2} name={r} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Constraint Shadow Prices */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Reactive Constraint Shadow Prices ($/MVAr)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={constraintChartData} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={140} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
            <Bar dataKey="shadow_price" fill="#a78bfa" name="Shadow Price ($/MVAr)" />
            <Bar dataKey="annual_cost"  fill="#f59e0b" name="Annual Cost ($M)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Voltage Events Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Voltage Events (2022–2024)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 px-3 text-left">Event ID</th>
                <th className="py-2 px-3 text-left">Date</th>
                <th className="py-2 px-3 text-left">Region</th>
                <th className="py-2 px-3 text-left">Bus</th>
                <th className="py-2 px-3 text-left">Event Type</th>
                <th className="py-2 px-3 text-right">Duration (s)</th>
                <th className="py-2 px-3 text-right">Q Deficit (MVAr)</th>
                <th className="py-2 px-3 text-right">Load Affected (MW)</th>
                <th className="py-2 px-3 text-right">Market Impact ($M)</th>
              </tr>
            </thead>
            <tbody>
              {voltage_events.map(e => (
                <tr key={e.event_id} className="border-b border-gray-700/50 hover:bg-gray-700/40">
                  <td className="py-2 px-3 text-gray-300 font-mono">{e.event_id}</td>
                  <td className="py-2 px-3 text-gray-300">{e.event_date}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: REGION_COLOURS[e.region] + '33', color: REGION_COLOURS[e.region] }}>
                      {e.region}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-300">{e.bus_name}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      e.event_type.includes('Collapse') ? 'bg-red-900/50 text-red-300' :
                      e.event_type.includes('Under')    ? 'bg-amber-900/50 text-amber-300' :
                      e.event_type.includes('Over')     ? 'bg-orange-900/50 text-orange-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>{e.event_type}</span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300">{e.duration_seconds}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{e.reactive_deficit_mvar}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{e.load_affected_mw}</td>
                  <td className="py-2 px-3 text-right font-medium text-red-400">${e.market_impact_m.toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generator VAr Capability Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Generator VAr Capability &amp; Compliance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 px-3 text-left">Generator</th>
                <th className="py-2 px-3 text-left">Technology</th>
                <th className="py-2 px-3 text-left">Region</th>
                <th className="py-2 px-3 text-right">Capacity (MW)</th>
                <th className="py-2 px-3 text-right">Q Cap (MVAr)</th>
                <th className="py-2 px-3 text-right">Q Ind (MVAr)</th>
                <th className="py-2 px-3 text-right">PF Lead</th>
                <th className="py-2 px-3 text-right">PF Lag</th>
                <th className="py-2 px-3 text-center">AVR</th>
                <th className="py-2 px-3 text-center">Compliant</th>
                <th className="py-2 px-3 text-right">Age (yrs)</th>
              </tr>
            </thead>
            <tbody>
              {generator_capabilities.map(g => (
                <tr key={g.capability_id} className="border-b border-gray-700/50 hover:bg-gray-700/40">
                  <td className="py-2 px-3 text-gray-200 font-medium">{g.generator_name}</td>
                  <td className="py-2 px-3 text-gray-400">{g.technology}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: REGION_COLOURS[g.region] + '33', color: REGION_COLOURS[g.region] }}>
                      {g.region}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300">{g.capacity_mw.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-emerald-400">{g.q_cap_mvar}</td>
                  <td className="py-2 px-3 text-right text-red-400">{g.q_ind_mvar}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{g.power_factor_lead.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{g.power_factor_lag.toFixed(2)}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${g.automatic_voltage_regulation ? 'bg-emerald-900/50 text-emerald-300' : 'bg-gray-700 text-gray-400'}`}>
                      {g.automatic_voltage_regulation ? 'AVR' : 'Manual'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${g.reactive_compliance ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'}`}>
                      {g.reactive_compliance ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-400">{g.age_years}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
