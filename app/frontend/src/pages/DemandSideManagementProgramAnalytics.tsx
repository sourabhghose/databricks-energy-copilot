import { useEffect, useState } from 'react'
import { Sliders } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { getDemandSideManagementProgramDashboard, DSMPDashboard } from '../api/client'

export default function DemandSideManagementProgramAnalytics() {
  const [data, setData] = useState<DSMPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDemandSideManagementProgramDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading DSM Program Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  // ── Chart 1: Enrolled customers by program × year (stacked bars per program) ──
  const enrolmentByProgram: Record<string, { program: string; '2022': number; '2023': number; '2024': number }> = {}
  for (const p of data.programs) {
    enrolmentByProgram[p.program_id] = { program: p.program_name.split(' ').slice(-1)[0], '2022': 0, '2023': 0, '2024': 0 }
  }
  for (const t of data.enrolment_trends) {
    if (t.month === 6 && enrolmentByProgram[t.program_id]) {
      const yr = String(t.year) as '2022' | '2023' | '2024'
      enrolmentByProgram[t.program_id][yr] = t.enrolled_customers
    }
  }
  const enrolmentChartData = Object.values(enrolmentByProgram)

  // ── Chart 2: Monthly active_participants 2024 for top 4 programs ──
  const top4 = [...data.programs]
    .sort((a, b) => b.enrolled_customers - a.enrolled_customers)
    .slice(0, 4)
  const top4Ids = top4.map(p => p.program_id)
  const monthlyMap: Record<number, Record<string, number>> = {}
  for (let m = 1; m <= 12; m++) {
    monthlyMap[m] = { month: m }
  }
  for (const t of data.enrolment_trends) {
    if (t.year === 2024 && top4Ids.includes(t.program_id)) {
      const prog = data.programs.find(p => p.program_id === t.program_id)
      if (prog) {
        const label = prog.program_name.split(' ').slice(-1)[0]
        monthlyMap[t.month][label] = t.active_participants
      }
    }
  }
  const monthlyChartData = Object.values(monthlyMap).sort((a, b) => (a.month as number) - (b.month as number))
  const top4Labels = top4.map(p => p.program_name.split(' ').slice(-1)[0])
  const lineColors = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24']

  // ── Chart 3: Event performance_pct sorted descending ──
  const eventChartData = [...data.event_performance]
    .sort((a, b) => b.performance_pct - a.performance_pct)
    .map(e => ({
      event: e.event_id,
      performance_pct: e.performance_pct,
      region: e.region,
    }))

  // ── Chart 4: Cost-benefit breakdown by program_id (latest year) ──
  const cbByProgram: Record<string, { program: string; costs: number; benefits: number }> = {}
  for (const p of data.programs) {
    cbByProgram[p.program_id] = {
      program: p.program_id,
      costs: 0,
      benefits: 0,
    }
  }
  for (const cb of data.cost_benefit) {
    if (cb.year === 2024 && cbByProgram[cb.program_id]) {
      cbByProgram[cb.program_id].costs += cb.program_costs_m + cb.customer_incentive_paid_m
      cbByProgram[cb.program_id].benefits += cb.network_deferral_benefit_m + cb.avoided_wholesale_cost_m
    }
  }
  const cbChartData = Object.values(cbByProgram).map(d => ({
    ...d,
    costs: Math.round(d.costs * 100) / 100,
    benefits: Math.round(d.benefits * 100) / 100,
  }))

  // ── Chart 5: Technology installed_capacity_mw ──
  const techChartData = data.technologies.map(t => ({
    technology: t.technology_type,
    capacity_mw: t.installed_capacity_mw,
    region: t.region,
  }))

  const techColors: Record<string, string> = {
    'Smart Thermostat': '#60a5fa',
    'Pool Pump Control': '#34d399',
    'EV Smart Charging': '#f472b6',
    'Hot Water Timer': '#fbbf24',
    'Battery Aggregation': '#a78bfa',
    'HVAC Control': '#fb923c',
    'Industrial DR': '#38bdf8',
  }

  const kpis = [
    { label: 'Total Enrolled Customers', value: data.summary.total_enrolled_customers.toLocaleString(), unit: '' },
    { label: 'Total Peak Reduction', value: data.summary.total_peak_reduction_mw.toFixed(1), unit: ' MW' },
    { label: 'Total Annual Saving', value: data.summary.total_annual_saving_gwh.toFixed(2), unit: ' GWh' },
    { label: 'Avg Performance', value: data.summary.avg_performance_pct.toFixed(1), unit: '%' },
  ]

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Sliders size={28} className="text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">DSM Program Analytics</h1>
          <p className="text-sm text-gray-400">Demand Side Management Program Performance Dashboard</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpis.map(k => (
          <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">{k.label}</div>
            <div className="text-2xl font-bold text-white">
              {k.value}<span className="text-base font-normal text-gray-400">{k.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 bg-gray-800 rounded-xl p-3 border border-gray-700 text-sm text-gray-300">
        Best Performing Program: <span className="text-blue-400 font-semibold">{data.summary.best_performing_program}</span>
        &nbsp;&middot;&nbsp; Total Net Benefit: <span className="text-green-400 font-semibold">${data.summary.total_net_benefit_m.toFixed(2)}M</span>
      </div>

      {/* Chart 1: Enrolled customers by program × year */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Enrolled Customers by Program &amp; Year</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={enrolmentChartData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="program" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="2022" stackId="a" fill="#3b82f6" name="2022" />
            <Bar dataKey="2023" stackId="a" fill="#10b981" name="2023" />
            <Bar dataKey="2024" stackId="a" fill="#f59e0b" name="2024" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Monthly active participants 2024 — top 4 programs */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Monthly Active Participants 2024 — Top 4 Programs</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={monthlyChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={m => `M${m}`} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {top4Labels.map((label, idx) => (
              <Line
                key={label}
                type="monotone"
                dataKey={label}
                stroke={lineColors[idx]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Event performance % sorted descending */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Event Performance % (Sorted Descending)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={eventChartData} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="event" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 'auto']} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
              formatter={(v: number) => [`${v}%`, 'Performance']}
            />
            <Bar dataKey="performance_pct" fill="#60a5fa" name="Performance %" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Cost-benefit breakdown by program */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Cost vs Benefit by Program (2024, $M)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={cbChartData} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="program" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="costs" stackId="cb" fill="#ef4444" name="Costs ($M)" />
            <Bar dataKey="benefits" stackId="cb" fill="#22c55e" name="Benefits ($M)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Technology installed capacity */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Technology Installed Capacity (MW)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={techChartData} margin={{ top: 5, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-40} textAnchor="end" />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }} />
            <Bar dataKey="capacity_mw" name="Installed Capacity (MW)" radius={[3, 3, 0, 0]}>
              {techChartData.map((entry, index) => (
                <rect key={index} fill={techColors[entry.technology] ?? '#60a5fa'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Programs table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Program Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Program</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">Customers</th>
                <th className="text-right py-2 pr-4">Peak Reduction MW</th>
                <th className="text-right py-2 pr-4">Annual Saving GWh</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.programs.map(p => (
                <tr key={p.program_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-white font-medium">{p.program_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.program_type}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.region}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.enrolled_customers.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-blue-400">{p.peak_demand_reduction_mw.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-green-400">{p.annual_energy_saving_gwh.toFixed(2)}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.status === 'Active' ? 'bg-green-900 text-green-300' :
                      p.status === 'Expanding' ? 'bg-blue-900 text-blue-300' :
                      p.status === 'Pilot' ? 'bg-yellow-900 text-yellow-300' :
                      'bg-red-900 text-red-300'
                    }`}>{p.status}</span>
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
