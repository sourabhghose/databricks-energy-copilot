import { useEffect, useState } from 'react'
import { Sun, Zap, TrendingUp, DollarSign } from 'lucide-react'
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
import { getSolarParkRegistryDashboard } from '../api/client'
import type { SPARDashboard } from '../api/client'

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
// Chart Card wrapper
// ---------------------------------------------------------------------------

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------

const STATE_COLORS: Record<string, string> = {
  NT: '#f97316',
  NSW: '#3b82f6',
  QLD: '#f59e0b',
  VIC: '#8b5cf6',
  SA:  '#ef4444',
  TAS: '#06b6d4',
  WA:  '#22c55e',
}

const PARK_LINE_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
]

const COMPONENT_COLORS: Record<string, string> = {
  Inverter:    '#3b82f6',
  Tracker:     '#f59e0b',
  Panel:       '#22c55e',
  Transformer: '#8b5cf6',
  Cable:       '#f97316',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SolarParkRegistryAnalytics() {
  const [data, setData] = useState<SPARDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSolarParkRegistryDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Solar Park Registry…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  const { parks, generation, components, revenue, summary } = data

  // ── Chart 1: Park DC capacity sorted desc, coloured by state ──────────────
  const capacityData = [...parks]
    .sort((a, b) => b.dc_capacity_mw - a.dc_capacity_mw)
    .map((p) => ({
      name: p.park_name.replace(' Solar', '').replace(' Farm', '').replace(' Park', ''),
      capacity: p.dc_capacity_mw,
      state: p.state,
    }))

  // ── Chart 2: Monthly PR trend 2022-2024 for top-5 parks by avg PR ─────────
  const parkAvgPR: Record<string, number[]> = {}
  for (const g of generation) {
    if (!parkAvgPR[g.park_name]) parkAvgPR[g.park_name] = []
    parkAvgPR[g.park_name].push(g.performance_ratio_pct)
  }
  const top5Parks = Object.entries(parkAvgPR)
    .map(([name, vals]) => ({ name, avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)
    .map((x) => x.name)

  // Build monthly series: key = "YYYY-MM"
  const monthlyMap: Record<string, Record<string, number>> = {}
  for (const g of generation.filter((g) => top5Parks.includes(g.park_name))) {
    const key = `${g.year}-${String(g.month).padStart(2, '0')}`
    if (!monthlyMap[key]) monthlyMap[key] = {}
    monthlyMap[key][g.park_name] = g.performance_ratio_pct
  }
  const prTrendData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, vals]) => ({ period, ...vals }))

  // ── Chart 3: Component availability by type (avg across parks) ────────────
  const compTypeMap: Record<string, number[]> = {}
  for (const c of components) {
    if (!compTypeMap[c.component_type]) compTypeMap[c.component_type] = []
    compTypeMap[c.component_type].push(c.availability_pct)
  }
  const componentData = Object.entries(compTypeMap).map(([type, vals]) => ({
    type,
    availability: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
  }))

  // ── Chart 4: Stacked revenue for top-8 parks (2024) ──────────────────────
  const parkRevMap: Record<string, { energy: number; lgc: number; merchant: number; ppa: number }> = {}
  for (const r of revenue.filter((r) => r.year === 2024)) {
    if (!parkRevMap[r.park_name]) {
      parkRevMap[r.park_name] = { energy: 0, lgc: 0, merchant: 0, ppa: 0 }
    }
    parkRevMap[r.park_name].energy += r.energy_revenue_m_aud
    parkRevMap[r.park_name].lgc += r.lgc_revenue_m_aud
    parkRevMap[r.park_name].merchant += r.merchant_revenue_m_aud
    parkRevMap[r.park_name].ppa += r.ppa_revenue_m_aud
  }
  const revenueData = Object.entries(parkRevMap)
    .map(([name, vals]) => ({
      name: name.replace(' Solar', '').replace(' Farm', '').replace(' Park', ''),
      energy: Math.round(vals.energy * 10) / 10,
      lgc: Math.round(vals.lgc * 10) / 10,
      merchant: Math.round(vals.merchant * 10) / 10,
      ppa: Math.round(vals.ppa * 10) / 10,
    }))
    .sort((a, b) => (b.energy + b.lgc + b.merchant + b.ppa) - (a.energy + a.lgc + a.merchant + a.ppa))
    .slice(0, 8)

  // ── Chart 5: Avg soiling loss & temperature derating by park (2024) ───────
  const lossMap: Record<string, { soiling: number[]; temp: number[] }> = {}
  for (const g of generation.filter((g) => g.year === 2024)) {
    if (!lossMap[g.park_name]) lossMap[g.park_name] = { soiling: [], temp: [] }
    lossMap[g.park_name].soiling.push(g.soiling_loss_pct)
    lossMap[g.park_name].temp.push(g.temperature_derating_pct)
  }
  const lossData = Object.entries(lossMap).map(([name, vals]) => ({
    name: name.replace(' Solar', '').replace(' Farm', '').replace(' Park', ''),
    soiling: Math.round((vals.soiling.reduce((a, b) => a + b, 0) / vals.soiling.length) * 10) / 10,
    temp: Math.round((vals.temp.reduce((a, b) => a + b, 0) / vals.temp.length) * 10) / 10,
  }))

  return (
    <div className="min-h-screen bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sun size={28} className="text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Solar Park Asset Registry Analytics</h1>
          <p className="text-sm text-gray-400">SPAR — Sprint 158c | Australian utility-scale solar fleet</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Solar Parks"
          value={summary.total_parks.toString()}
          sub="Registered in SPAR"
          icon={Sun}
          color="bg-amber-500"
        />
        <KpiCard
          title="Total DC Capacity"
          value={`${summary.total_capacity_mw.toLocaleString()} MW`}
          sub="Across all parks"
          icon={Zap}
          color="bg-blue-500"
        />
        <KpiCard
          title="Avg Performance Ratio"
          value={`${summary.avg_performance_ratio_pct}%`}
          sub="Fleet average 2022-2024"
          icon={TrendingUp}
          color="bg-green-500"
        />
        <KpiCard
          title="2024 Total Revenue"
          value={`A$${summary.total_revenue_2024_m_aud.toLocaleString()}M`}
          sub="Energy + LGC + Merchant + PPA"
          icon={DollarSign}
          color="bg-purple-500"
        />
      </div>

      {/* Chart 1: Park capacity sorted desc */}
      <ChartCard title="Park DC Capacity (MW) — Sorted Descending, Coloured by State">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={capacityData} margin={{ top: 5, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="capacity" name="DC Capacity (MW)" radius={[4, 4, 0, 0]}>
              {capacityData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={STATE_COLORS[entry.state] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(STATE_COLORS).map(([state, color]) => (
            <span key={state} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {state}
            </span>
          ))}
        </div>
      </ChartCard>

      {/* Chart 2: Monthly PR trend for top-5 parks */}
      <ChartCard title="Monthly Performance Ratio (%) — Top 5 Parks by Average PR (2022-2024)">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={prTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[70, 110]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '11px' }} />
            {top5Parks.map((park, i) => (
              <Line
                key={park}
                type="monotone"
                dataKey={park}
                stroke={PARK_LINE_COLORS[i % PARK_LINE_COLORS.length]}
                dot={false}
                strokeWidth={2}
                name={park.length > 22 ? park.slice(0, 22) + '…' : park}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 3: Component availability by type */}
      <ChartCard title="Average Component Availability (%) by Type — Fleet-Wide">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={componentData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[85, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="availability" name="Avg Availability (%)" radius={[4, 4, 0, 0]}>
              {componentData.map((entry, index) => (
                <Cell
                  key={`cell-comp-${index}`}
                  fill={COMPONENT_COLORS[entry.type] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 4: Stacked quarterly revenue breakdown top-8 parks 2024 */}
      <ChartCard title="2024 Revenue Breakdown (A$M) — Top 8 Parks by Total Revenue (Stacked)">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '11px' }} />
            <Bar dataKey="energy" name="Energy Revenue" stackId="rev" fill="#f59e0b" />
            <Bar dataKey="lgc" name="LGC Revenue" stackId="rev" fill="#22c55e" />
            <Bar dataKey="merchant" name="Merchant Revenue" stackId="rev" fill="#3b82f6" />
            <Bar dataKey="ppa" name="PPA Revenue" stackId="rev" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 5: Soiling & temperature derating by park (2024) */}
      <ChartCard title="Avg Soiling Loss & Temperature Derating (%) by Park — 2024">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={lossData} margin={{ top: 5, right: 20, left: 10, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '11px' }} />
            <Bar dataKey="soiling" name="Soiling Loss %" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="temp" name="Temperature Derating %" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
