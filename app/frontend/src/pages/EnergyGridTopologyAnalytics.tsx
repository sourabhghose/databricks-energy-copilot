import { useEffect, useState } from 'react'
import { Network, Activity, TrendingUp, MapPin, AlertTriangle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getEnergyGridTopologyDashboard } from '../api/client'
import type { EGTAdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const REGION_COLOURS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#6366f1',
  QLD: '#f59e0b',
  SA:  '#10b981',
  TAS: '#8b5cf6',
}

const FAULT_TYPE_COLOURS: Record<string, string> = {
  Lightning:           '#f59e0b',
  'Equipment Failure': '#ef4444',
  'Third Party':       '#8b5cf6',
  Weather:             '#06b6d4',
}

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
// Main Page
// ---------------------------------------------------------------------------
export default function EnergyGridTopologyAnalytics() {
  const [data, setData] = useState<EGTAdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEnergyGridTopologyDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Energy Grid Topology Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { substations, transmission_lines, faults, capacity, summary } = data

  const regions = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']
  const faultTypes = ['Lightning', 'Equipment Failure', 'Third Party', 'Weather']

  // Chart 1: Transformer capacity MVA by substation (top 12, sorted desc)
  const transformerCapacityTop12 = [...substations]
    .sort((a, b) => b.transformer_capacity_mva - a.transformer_capacity_mva)
    .slice(0, 12)
    .map(s => ({
      name: s.substation_name.replace(/ /g, '\n'),
      transformer_capacity_mva: Math.round(s.transformer_capacity_mva * 10) / 10,
      region: s.region,
    }))

  // Chart 2: Transmission line loading % by region (average, sorted by loading)
  const lineLoadingByRegion = regions
    .map(region => {
      const lines = transmission_lines.filter(l => l.region === region)
      const avg = lines.length > 0
        ? Math.round((lines.reduce((s, l) => s + l.current_loading_pct, 0) / lines.length) * 10) / 10
        : 0
      return { region, avg_loading_pct: avg }
    })
    .sort((a, b) => b.avg_loading_pct - a.avg_loading_pct)

  // Chart 3: Fault events by type per region (2024, stacked)
  const faults2024 = faults.filter(f => f.year === 2024)
  const faultsByRegion = regions.map(region => {
    const row: Record<string, string | number> = { region }
    for (const ft of faultTypes) {
      row[ft] = faults2024.filter(f => f.region === region && f.fault_type === ft).length
    }
    return row
  })

  // Chart 4: Available vs required transfer capacity by region (2024 Q4, grouped)
  const capacity2024Q4 = capacity.filter(c => c.year === 2024 && c.quarter === 'Q4')
  const capacityByRegion = regions.map(region => {
    const rec = capacity2024Q4.find(c => c.region === region)
    return {
      region,
      available_capacity_mw: rec ? Math.round(rec.available_capacity_mw) : 0,
      total_transfer_capacity_mw: rec ? Math.round(rec.total_transfer_capacity_mw) : 0,
    }
  })

  // Chart 5: Substation condition score by region (average)
  const conditionByRegion = regions.map(region => {
    const subs = substations.filter(s => s.region === region)
    const avg = subs.length > 0
      ? Math.round((subs.reduce((s, sub) => s + sub.condition_score, 0) / subs.length) * 10) / 10
      : 0
    return { region, avg_condition_score: avg }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-cyan-600 border-b border-cyan-700 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-cyan-800 rounded-lg">
          <Network size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Energy Grid Topology Analytics</h1>
          <p className="text-xs text-cyan-200">Substations, Transmission Lines, Fault Events & Transfer Capacity — NEM Regions</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total Substations"
            value={String(summary.total_substations)}
            sub="Across all NEM regions"
            icon={Network}
            color="bg-cyan-600"
          />
          <KpiCard
            title="Total Transmission Lines"
            value={String(summary.total_transmission_lines)}
            sub="Across all NEM regions"
            icon={Activity}
            color="bg-blue-600"
          />
          <KpiCard
            title="Avg Line Loading"
            value={`${summary.avg_line_loading_pct.toFixed(1)}%`}
            sub="Current loading average"
            icon={TrendingUp}
            color="bg-yellow-600"
          />
          <KpiCard
            title="Most Constrained Region"
            value={summary.most_constrained_region}
            sub="Highest constrained hours"
            icon={MapPin}
            color="bg-red-600"
          />
        </div>

        {/* Chart 1: Transformer capacity MVA by substation (top 12, sorted desc) */}
        <ChartCard title="Transformer Capacity MVA — Top 12 Substations (sorted descending)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={transformerCapacityTop12}
              margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MVA" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar
                dataKey="transformer_capacity_mva"
                name="Transformer Capacity (MVA)"
                fill="#06b6d4"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Transmission line loading % by region (sorted by loading) */}
        <ChartCard title="Avg Transmission Line Loading % by Region (sorted descending)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={lineLoadingByRegion} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" domain={[0, 110]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="avg_loading_pct" name="Avg Loading %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Fault events by type per region (2024, stacked bar) */}
        <ChartCard title="Fault Events by Type per Region — 2024 (stacked)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={faultsByRegion} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {faultTypes.map(ft => (
                <Bar
                  key={ft}
                  dataKey={ft}
                  name={ft}
                  stackId="faults"
                  fill={FAULT_TYPE_COLOURS[ft]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Available vs required transfer capacity by region (2024 Q4, grouped) */}
        <ChartCard title="Available vs Total Transfer Capacity by Region — 2024 Q4 (MW, grouped)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={capacityByRegion} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="total_transfer_capacity_mw" name="Total Transfer Capacity (MW)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="available_capacity_mw" name="Available Capacity (MW)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Substation condition score by region (average) */}
        <ChartCard title="Avg Substation Condition Score by Region (1 = poor, 10 = excellent)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={conditionByRegion} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 10]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="avg_condition_score" name="Avg Condition Score" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
