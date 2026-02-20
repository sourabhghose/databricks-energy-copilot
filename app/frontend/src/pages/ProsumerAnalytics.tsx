// Sprint 60c — Prosumer & Behind-the-Meter (BTM) Analytics

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { Sun } from 'lucide-react'
import {
  getProsumerDashboard,
  ProsumerDashboard,
  BTMInstallationRecord,
  BTMNetLoadRecord,
  BTMExportRecord,
  BTMVppRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const STATE_COLOURS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  QLD: '#fbbf24',
  SA:  '#f87171',
  WA:  '#a78bfa',
}

const fmtNum = (n: number, dp = 1) => n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps { label: string; value: string; sub?: string; colour: string }

function KpiCard({ label, value, sub, colour }: KpiProps) {
  return (
    <div className={`bg-gray-800 rounded-xl p-5 border-t-4`} style={{ borderTopColor: colour }}>
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers for derived data
// ---------------------------------------------------------------------------

function buildInstallationChartData(installations: BTMInstallationRecord[]) {
  const byYear: Record<number, Record<string, number>> = {}
  for (const r of installations) {
    if (!byYear[r.year]) byYear[r.year] = {}
    byYear[r.year][r.state] = r.rooftop_solar_mw
  }
  return Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, states]) => ({ year, ...states }))
}

function buildDuckCurveData(netLoad: BTMNetLoadRecord[], targetState = 'SA') {
  return netLoad
    .filter(r => r.state === targetState)
    .sort((a, b) => {
      const order = ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov']
      return order.indexOf(a.month) - order.indexOf(b.month)
    })
    .map(r => ({
      month: r.month,
      gross: r.gross_demand_gwh,
      net: r.net_demand_gwh,
      solar: r.btm_solar_generation_gwh,
      duck_depth: r.duck_curve_depth_mw,
    }))
}

function buildExportChartData(exports: BTMExportRecord[]) {
  const byYear: Record<number, Record<string, number>> = {}
  for (const r of exports) {
    if (!byYear[r.year]) byYear[r.year] = {}
    byYear[r.year][r.state] = r.total_exports_gwh
  }
  return Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, states]) => ({ year, ...states }))
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProsumerAnalytics() {
  const [data, setData] = useState<ProsumerDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProsumerDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 animate-pulse">Loading prosumer data…</div>
    </div>
  )
  if (error || !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-red-400">Failed to load dashboard: {error}</div>
    </div>
  )

  // ---- Derived KPIs ----
  const latestInstalls = data.installations.filter(r => r.year === 2024)
  const totalSolarGW = latestInstalls.reduce((s, r) => s + r.rooftop_solar_mw, 0) / 1000
  const totalBatteryGWh = latestInstalls.reduce((s, r) => s + r.btm_battery_mwh, 0) / 1000
  const latestExports = data.exports.filter(r => r.year === 2024)
  const totalExportsGWh = latestExports.reduce((s, r) => s + r.total_exports_gwh, 0)
  const totalVppCustomers = data.vpps.reduce((s, r) => s + r.enrolled_customers_k, 0)

  const installChart = buildInstallationChartData(data.installations)
  const duckChart = buildDuckCurveData(data.net_load, 'SA')
  const exportChart = buildExportChartData(data.exports)

  return (
    <div className="space-y-8 p-6 bg-gray-900 min-h-screen text-white">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-amber-500/20 p-2 rounded-lg">
          <Sun className="text-amber-400" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Prosumer &amp; Behind-the-Meter Analytics</h1>
          <p className="text-gray-400 text-sm">Rooftop solar · BTM batteries · Net load impact · Virtual Power Plants</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Rooftop Solar (2024)"
          value={`${fmtNum(totalSolarGW, 2)} GW`}
          sub="Across NSW, VIC, QLD, SA, WA"
          colour="#fbbf24"
        />
        <KpiCard
          label="BTM Battery Capacity (2024)"
          value={`${fmtNum(totalBatteryGWh, 2)} GWh`}
          sub="Behind-the-meter storage"
          colour="#34d399"
        />
        <KpiCard
          label="Annual Exports (2024)"
          value={`${fmtNum(totalExportsGWh, 0)} GWh`}
          sub="Total NEM solar exports"
          colour="#60a5fa"
        />
        <KpiCard
          label="VPP Enrolled Customers"
          value={`${fmtNum(totalVppCustomers, 0)} k`}
          sub={`${data.vpps.length} active VPP programmes`}
          colour="#a78bfa"
        />
      </div>

      {/* Installation Growth — stacked area */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Rooftop Solar Installed Capacity by State (MW) 2020-2024</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={installChart} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => `${v} MW`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${fmtNum(v, 0)} MW`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(st => (
              <Area
                key={st}
                type="monotone"
                dataKey={st}
                stackId="1"
                stroke={STATE_COLOURS[st]}
                fill={STATE_COLOURS[st]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Duck Curve — SA */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Duck Curve — SA Net vs Gross Demand</h2>
        <p className="text-gray-400 text-xs mb-4">Monthly gross demand vs net demand after BTM solar &amp; battery discharge (GWh). Duck curve depth annotated.</p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={duckChart} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis yAxisId="gwh" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => `${v} GWh`} />
            <YAxis yAxisId="mw" orientation="right" stroke="#f87171" tick={{ fill: '#f87171', fontSize: 12 }} tickFormatter={v => `${v} MW`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            <Area
              yAxisId="gwh"
              type="monotone"
              dataKey="gross"
              name="Gross Demand (GWh)"
              stroke="#60a5fa"
              fill="#60a5fa"
              fillOpacity={0.25}
            />
            <Area
              yAxisId="gwh"
              type="monotone"
              dataKey="net"
              name="Net Demand (GWh)"
              stroke="#34d399"
              fill="#34d399"
              fillOpacity={0.35}
            />
            <Line
              yAxisId="mw"
              type="monotone"
              dataKey="duck_depth"
              name="Duck Curve Depth (MW)"
              stroke="#f87171"
              strokeDasharray="5 3"
              dot={{ r: 4, fill: '#f87171' }}
            />
            <ReferenceLine yAxisId="gwh" y={1000} stroke="#fbbf24" strokeDasharray="4 2" label={{ value: 'Demand floor', fill: '#fbbf24', fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Export Trends */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Solar Export Trends by State (GWh) 2021-2024</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={exportChart} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => `${v} GWh`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${fmtNum(v, 0)} GWh`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(st => (
              <Line
                key={st}
                type="monotone"
                dataKey={st}
                stroke={STATE_COLOURS[st]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Export curtailment bar */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Export Curtailment by State 2024 (%)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={latestExports.map(r => ({ state: r.state, curtailment: r.curtailment_pct, constrained: r.grid_constraint_triggered }))}
            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${fmtNum(v, 1)}%`, 'Curtailment']}
            />
            <ReferenceLine y={5} stroke="#fbbf24" strokeDasharray="4 2" label={{ value: '5% threshold', fill: '#fbbf24', fontSize: 11 }} />
            <Bar dataKey="curtailment" name="Curtailment %" radius={[4, 4, 0, 0]}>
              {latestExports.map(r => (
                <Cell key={r.state} fill={r.grid_constraint_triggered ? '#f87171' : '#34d399'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-gray-500 text-xs mt-2">Red bars indicate grid constraint triggered. Threshold line at 5%.</p>
      </div>

      {/* VPP Comparison Table */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Virtual Power Plant Programmes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700">
                {['Programme', 'State', 'Customers (k)', 'Battery (MWh)', 'Peak Dispatch (MW)', 'Events/yr', 'Avg Duration (hr)', 'Revenue/Customer (AUD)', 'Operator'].map(h => (
                  <th key={h} className="py-3 px-3 text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.vpps]
                .sort((a, b) => b.total_battery_mwh - a.total_battery_mwh)
                .map((vpp, idx) => (
                  <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-3 text-white font-medium">{vpp.vpp_name}</td>
                    <td className="py-3 px-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ backgroundColor: STATE_COLOURS[vpp.state] + '33', color: STATE_COLOURS[vpp.state] }}
                      >
                        {vpp.state}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-blue-300 text-right">{fmtNum(vpp.enrolled_customers_k, 0)}</td>
                    <td className="py-3 px-3 text-emerald-300 text-right">{fmtNum(vpp.total_battery_mwh, 1)}</td>
                    <td className="py-3 px-3 text-amber-300 text-right">{fmtNum(vpp.peak_dispatch_mw, 1)}</td>
                    <td className="py-3 px-3 text-gray-200 text-right">{vpp.annual_events}</td>
                    <td className="py-3 px-3 text-gray-200 text-right">{fmtNum(vpp.avg_event_duration_hr, 1)}</td>
                    <td className="py-3 px-3 text-purple-300 text-right">${fmtNum(vpp.revenue_per_customer_aud, 0)}</td>
                    <td className="py-3 px-3 text-gray-300">{vpp.operator}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-600">
                <td className="py-3 px-3 text-gray-400 font-semibold">Total / Average</td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3 text-blue-300 font-semibold text-right">{data.vpps.reduce((s, v) => s + v.enrolled_customers_k, 0)}</td>
                <td className="py-3 px-3 text-emerald-300 font-semibold text-right">{fmtNum(data.vpps.reduce((s, v) => s + v.total_battery_mwh, 0), 1)}</td>
                <td className="py-3 px-3 text-amber-300 font-semibold text-right">{fmtNum(data.vpps.reduce((s, v) => s + v.peak_dispatch_mw, 0), 1)}</td>
                <td className="py-3 px-3 text-gray-200 font-semibold text-right">{fmtNum(data.vpps.reduce((s, v) => s + v.annual_events, 0) / data.vpps.length, 0)} avg</td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3 text-purple-300 font-semibold text-right">${fmtNum(data.vpps.reduce((s, v) => s + v.revenue_per_customer_aud, 0) / data.vpps.length, 0)} avg</td>
                <td className="py-3 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  )
}
