import { useEffect, useState } from 'react'
import { Battery, DollarSign, Activity, TrendingUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { getBessPerformanceDashboard } from '../api/client'
import type { BESSPerfDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  'Li-Ion LFP':    '#34d399',
  'Li-Ion NMC':    '#60a5fa',
  'Vanadium Flow': '#a78bfa',
  'Zinc-Bromine':  '#fbbf24',
  'NaS':           '#f87171',
}

const SYSTEM_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#e879f9',
  '#22d3ee', '#fb923c',
]

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BessPerformanceAnalytics() {
  const [data, setData] = useState<BESSPerfDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBessPerformanceDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900 min-h-screen">
        Loading BESS Performance Analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 bg-gray-900 min-h-screen">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const { summary, systems, operations, degradation, revenue } = data

  // ── Chart 1: System capacity sorted descending, coloured by technology ──
  const capacityChartData = [...systems]
    .sort((a, b) => b.capacity_mwh - a.capacity_mwh)
    .map(s => ({
      name: s.system_name.replace(' Battery', '').replace(' BESS', '').replace(' Power Reserve', ''),
      capacity_mwh: s.capacity_mwh,
      technology: s.technology,
    }))

  // ── Chart 2: Monthly RTE trend by top-5 systems (2024) ──
  const systemsByCapacity = [...systems].sort((a, b) => b.capacity_mwh - a.capacity_mwh)
  const top5Systems = systemsByCapacity.slice(0, 5).map(s => s.system_name)

  const ops2024 = operations.filter(o => o.year === 2024)
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

  const rteByMonth: Record<number, Record<string, number>> = {}
  for (let m = 1; m <= 6; m++) {
    rteByMonth[m] = {}
    for (const sname of top5Systems) {
      const rec = ops2024.find(o => o.system_name === sname && o.month === m)
      if (rec) {
        const shortName = sname.split(' ').slice(0, 2).join(' ')
        rteByMonth[m][shortName] = rec.round_trip_efficiency_pct
      }
    }
  }

  const rteChartData = Array.from({ length: 6 }, (_, i) => ({
    month: monthLabels[i],
    ...rteByMonth[i + 1],
  }))

  const top5ShortNames = top5Systems.map(s => s.split(' ').slice(0, 2).join(' '))

  // ── Chart 3: State of health (2024) per system ──
  const soh2024 = degradation
    .filter(d => d.year === 2024)
    .map(d => {
      const shortName = d.system_name.replace(' Battery', '').replace(' BESS', '').replace(' Power Reserve', '')
      return { name: shortName, state_of_health_pct: d.state_of_health_pct }
    })
    .sort((a, b) => b.state_of_health_pct - a.state_of_health_pct)

  // ── Chart 4: Quarterly revenue breakdown for top-5 systems aggregated ──
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const top5Revenue2024 = revenue.filter(
    r => r.year === 2024 && top5Systems.includes(r.system_name)
  )

  const revenueByQuarter = quarters.map(q => {
    const qRecs = top5Revenue2024.filter(r => r.quarter === q)
    return {
      quarter: q,
      Arbitrage: parseFloat(qRecs.reduce((s, r) => s + r.arbitrage_revenue_m_aud, 0).toFixed(2)),
      FCAS: parseFloat(qRecs.reduce((s, r) => s + r.fcas_revenue_m_aud, 0).toFixed(2)),
      'Capacity Market': parseFloat(qRecs.reduce((s, r) => s + r.capacity_market_revenue_m_aud, 0).toFixed(2)),
    }
  })

  // ── Chart 5: Total revenue 2024 per system sorted descending ──
  const revenuePerSystem = systems.map(s => {
    const total = revenue
      .filter(r => r.system_name === s.system_name && r.year === 2024)
      .reduce((sum, r) => sum + r.total_revenue_m_aud, 0)
    const shortName = s.system_name.replace(' Battery', '').replace(' BESS', '').replace(' Power Reserve', '')
    return { name: shortName, total_revenue_m_aud: parseFloat(total.toFixed(2)) }
  }).sort((a, b) => b.total_revenue_m_aud - a.total_revenue_m_aud)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Battery size={28} className="text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">BESS Performance Analytics</h1>
          <p className="text-sm text-gray-400">Battery Energy Storage System — operational and financial performance</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Systems"
          value={String(summary.total_systems)}
          sub="Active BESS deployments"
          icon={Battery}
          color="bg-green-600"
        />
        <KpiCard
          title="Total Capacity"
          value={`${summary.total_capacity_mwh.toLocaleString()} MWh`}
          sub="Installed storage capacity"
          icon={Activity}
          color="bg-blue-600"
        />
        <KpiCard
          title="Avg Round-Trip Efficiency"
          value={`${summary.avg_round_trip_efficiency_pct}%`}
          sub="Across all systems & months"
          icon={TrendingUp}
          color="bg-purple-600"
        />
        <KpiCard
          title="2024 Total Revenue"
          value={`$${summary.total_revenue_2024_m_aud.toFixed(1)}M`}
          sub="AUD — arbitrage + FCAS + capacity"
          icon={DollarSign}
          color="bg-amber-600"
        />
      </div>

      {/* Chart 1: System Capacity by Technology */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">System Capacity (MWh) by Technology</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={capacityChartData} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
              formatter={(v: number) => [`${v} MWh`, 'Capacity']}
            />
            <Bar dataKey="capacity_mwh" name="Capacity (MWh)" radius={[4, 4, 0, 0]}>
              {capacityChartData.map((entry, idx) => (
                <Cell key={idx} fill={TECH_COLORS[entry.technology] ?? '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(TECH_COLORS).map(([tech, color]) => (
            <span key={tech} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Monthly RTE Trend (top-5 systems, 2024) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Monthly Round-Trip Efficiency % — Top 5 Systems (2024)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rteChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[80, 100]} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
              formatter={(v: number) => [`${v}%`, 'RTE']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {top5ShortNames.map((sname, idx) => (
              <Line
                key={sname}
                type="monotone"
                dataKey={sname}
                stroke={SYSTEM_COLORS[idx % SYSTEM_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: State of Health 2024 */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">State of Health % per System (2024)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={soh2024} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[85, 102]} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
              formatter={(v: number) => [`${v}%`, 'State of Health']}
            />
            <Bar dataKey="state_of_health_pct" name="SoH %" radius={[4, 4, 0, 0]}>
              {soh2024.map((_, idx) => (
                <Cell key={idx} fill={SYSTEM_COLORS[idx % SYSTEM_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Stacked quarterly revenue for top-5 systems */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Quarterly Revenue Breakdown — Top 5 Systems Aggregated (2024, $M AUD)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueByQuarter} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Arbitrage" stackId="a" fill="#60a5fa" />
            <Bar dataKey="FCAS" stackId="a" fill="#34d399" />
            <Bar dataKey="Capacity Market" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Total revenue 2024 per system */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-4">Total Revenue 2024 per System ($M AUD, descending)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={revenuePerSystem} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`, 'Revenue']}
            />
            <Bar dataKey="total_revenue_m_aud" name="Revenue ($M AUD)" radius={[4, 4, 0, 0]}>
              {revenuePerSystem.map((_, idx) => (
                <Cell key={idx} fill={SYSTEM_COLORS[idx % SYSTEM_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
