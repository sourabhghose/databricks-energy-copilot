import { useEffect, useState } from 'react'
import { Wind, Zap, TrendingUp, DollarSign } from 'lucide-react'
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
} from 'recharts'
import { getWindCapacityMarketDashboard } from '../api/client'
import type { WCMSDashboard } from '../api/client'

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
  NSW: '#3b82f6',
  QLD: '#f59e0b',
  VIC: '#8b5cf6',
  SA: '#ef4444',
  TAS: '#06b6d4',
  WA: '#22c55e',
}

const FARM_LINE_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
]

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function WindCapacityMarketAnalytics() {
  const [data, setData] = useState<WCMSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWindCapacityMarketDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Wind Capacity Market data...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? 'No data available'}</p>
      </div>
    )
  }

  // ── Chart 1: Farm installed_capacity_mw sorted desc, coloured by state ──
  const chart1Data = [...data.farms]
    .sort((a, b) => b.installed_capacity_mw - a.installed_capacity_mw)
    .map((f) => ({
      name: f.farm_name.replace(' Wind Farm', '').replace(' Farm', ''),
      capacity_mw: f.installed_capacity_mw,
      state: f.state,
      fill: STATE_COLORS[f.state] ?? '#6b7280',
    }))

  // ── Chart 2: Monthly capacity_factor_pct trend 2022-2024 for top-5 farms ──
  const top5Farms = [...data.farms]
    .sort((a, b) => b.installed_capacity_mw - a.installed_capacity_mw)
    .slice(0, 5)
    .map((f) => f.farm_name)

  // Build month keys: year-month pairs for years 2022-2024, months 1-4
  const monthKeys: { year: number; month: number; label: string }[] = []
  for (const year of [2022, 2023, 2024]) {
    for (const month of [1, 2, 3, 4]) {
      monthKeys.push({ year, month, label: `${year}-M${month}` })
    }
  }

  const chart2Data = monthKeys.map(({ year, month, label }) => {
    const row: Record<string, string | number> = { label }
    for (const farmName of top5Farms) {
      const rec = data.generation.find(
        (g) => g.farm_name === farmName && g.year === year && g.month === month,
      )
      const shortName = farmName.replace(' Wind Farm', '').replace(' Farm', '')
      row[shortName] = rec ? rec.capacity_factor_pct : 0
    }
    return row
  })

  const top5ShortNames = top5Farms.map((n) =>
    n.replace(' Wind Farm', '').replace(' Farm', ''),
  )

  // ── Chart 3: Quarterly revenue breakdown per farm (2024, top 8) stacked ──
  const top8Farms = [...data.farms]
    .sort((a, b) => b.installed_capacity_mw - a.installed_capacity_mw)
    .slice(0, 8)
    .map((f) => f.farm_name)

  const chart3Data = top8Farms.map((farmName) => {
    const records2024 = data.market.filter(
      (m) => m.farm_name === farmName && m.year === 2024,
    )
    const energy = records2024.reduce((s, r) => s + r.energy_revenue_m_aud, 0)
    const lrec = records2024.reduce((s, r) => s + r.lrec_revenue_m_aud, 0)
    const fcas = records2024.reduce((s, r) => s + r.fcas_revenue_m_aud, 0)
    const hedge = records2024.reduce((s, r) => s + r.hedge_premium_m_aud, 0)
    return {
      name: farmName.replace(' Wind Farm', '').replace(' Farm', ''),
      Energy: Math.round(energy * 10) / 10,
      LREC: Math.round(lrec * 10) / 10,
      FCAS: Math.round(fcas * 10) / 10,
      Hedge: Math.round(hedge * 10) / 10,
    }
  })

  // ── Chart 4: Regional penetration_pct and price_cannibalisation_pct (2024, grouped) ──
  const chart4Data = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map((region) => {
    const rec = data.regional.find((r) => r.region === region && r.year === 2024)
    return {
      region,
      Penetration: rec?.penetration_pct ?? 0,
      'Price Cannib.': rec?.price_cannibalisation_pct ?? 0,
    }
  })

  // ── Chart 5: Avg availability_pct by farm (2024) ──
  const chart5Data = data.farms.map((farm) => {
    const recs2024 = data.generation.filter(
      (g) => g.farm_name === farm.farm_name && g.year === 2024,
    )
    const avgAvail =
      recs2024.length > 0
        ? recs2024.reduce((s, g) => s + g.availability_pct, 0) / recs2024.length
        : 0
    return {
      name: farm.farm_name.replace(' Wind Farm', '').replace(' Farm', ''),
      availability_pct: Math.round(avgAvail * 10) / 10,
    }
  }).sort((a, b) => b.availability_pct - a.availability_pct)

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue-600">
          <Wind size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Wind Capacity Market Structure Analytics
          </h1>
          <p className="text-xs text-gray-400">
            WCMS — Australian NEM wind farm capacity, generation &amp; market revenue
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Installed Capacity"
          value={`${summary.total_installed_mw.toLocaleString()} MW`}
          sub="All NEM wind farms"
          icon={Wind}
          color="bg-blue-600"
        />
        <KpiCard
          title="Avg Capacity Factor"
          value={`${summary.avg_capacity_factor_pct}%`}
          sub="2022–2024 average"
          icon={TrendingUp}
          color="bg-purple-600"
        />
        <KpiCard
          title="Total Wind Farms"
          value={`${summary.total_farms}`}
          sub="Tracked in NEM"
          icon={Zap}
          color="bg-amber-600"
        />
        <KpiCard
          title="Total Revenue 2024"
          value={`$${summary.total_revenue_2024_m_aud.toLocaleString()}M`}
          sub="Energy + LREC + FCAS + Hedge"
          icon={DollarSign}
          color="bg-green-600"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Farm Installed Capacity */}
        <ChartCard title="Wind Farm Installed Capacity (MW) — sorted by size">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chart1Data} layout="vertical" margin={{ left: 80, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={80}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="capacity_mw" name="Capacity (MW)" radius={[0, 4, 4, 0]}>
                {chart1Data.map((entry, idx) => (
                  <rect key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* State legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(STATE_COLORS).map(([state, color]) => (
              <span key={state} className="flex items-center gap-1 text-xs text-gray-400">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                {state}
              </span>
            ))}
          </div>
        </ChartCard>

        {/* Chart 2: Monthly CF trend top-5 farms */}
        <ChartCard title="Monthly Capacity Factor (%) — Top 5 Farms 2022–2024">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chart2Data} margin={{ right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-45}
                textAnchor="end"
                height={55}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                domain={[0, 60]}
                unit="%"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {top5ShortNames.map((name, idx) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={FARM_LINE_COLORS[idx]}
                  dot={false}
                  strokeWidth={1.5}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Quarterly revenue breakdown stacked (2024, top 8) */}
        <ChartCard title="Annual Revenue Breakdown 2024 — Top 8 Farms ($M AUD, stacked)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chart3Data} layout="vertical" margin={{ left: 90, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={90}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="Energy" stackId="rev" fill="#3b82f6" name="Energy" radius={[0, 0, 0, 0]} />
              <Bar dataKey="LREC" stackId="rev" fill="#22c55e" name="LREC" />
              <Bar dataKey="FCAS" stackId="rev" fill="#f59e0b" name="FCAS" />
              <Bar dataKey="Hedge" stackId="rev" fill="#8b5cf6" name="Hedge" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Regional penetration & price cannibalisation (2024) */}
        <ChartCard title="Regional Wind Penetration & Price Cannibalisation (2024)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chart4Data} margin={{ right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="Penetration" fill="#3b82f6" name="Wind Penetration %" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Price Cannib." fill="#ef4444" name="Price Cannibalisation %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Avg availability_pct by farm (2024) */}
        <div className="lg:col-span-2">
          <ChartCard title="Average Turbine Availability (%) by Farm — 2024">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chart5Data} margin={{ right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  angle={-35}
                  textAnchor="end"
                  height={65}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  domain={[88, 100]}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="availability_pct" fill="#06b6d4" name="Availability %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
