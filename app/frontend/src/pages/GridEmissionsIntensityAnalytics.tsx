import { useEffect, useState } from 'react'
import { CloudRain, TrendingDown, Leaf, Flame } from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from 'recharts'
import { getGEIADashboard } from '../api/client'
import type { GEIADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  VIC1: '#ef4444',
  QLD1: '#f59e0b',
  SA1: '#10b981',
  TAS1: '#8b5cf6',
}

const GEN_MIX_COLOURS: Record<string, string> = {
  coal_pct: '#6b7280',
  gas_pct: '#f97316',
  hydro_pct: '#3b82f6',
  wind_pct: '#06b6d4',
  solar_pct: '#eab308',
  other_pct: '#a855f7',
}

const PERIOD_COLOURS: Record<string, string> = {
  PEAK: '#ef4444',
  OFFPEAK: '#10b981',
  SHOULDER: '#f59e0b',
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
    <div className="bg-gray-800 rounded-2xl p-6 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
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
    <div className="bg-gray-800 rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trend Badge
// ---------------------------------------------------------------------------
function TrendBadge({ trend }: { trend: string }) {
  const colour =
    trend === 'declining'
      ? 'bg-green-900 text-green-300'
      : trend === 'rising'
      ? 'bg-red-900 text-red-300'
      : 'bg-yellow-900 text-yellow-300'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colour}`}>
      {trend}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function GridEmissionsIntensityAnalytics() {
  const [data, setData] = useState<GEIADashboard | null>(null)

  useEffect(() => {
    getGEIADashboard().then(setData).catch(console.error)
  }, [])

  if (!data) {
    return <div className="min-h-screen bg-gray-900 p-8 text-white">Loading Grid Emissions Intensity Analytics dashboard...</div>
  }

  // ---- KPI calculations ----
  const regions = ['NSW1', 'VIC1', 'QLD1', 'SA1', 'TAS1']
  const latestMonth = data.regional.reduce((m, r) => (r.month > m ? r.month : m), '')
  const latestRecords = data.regional.filter(r => r.month === latestMonth)
  const nemAvg = latestRecords.reduce((s, r) => s + r.avg_intensity_tco2_mwh, 0) / latestRecords.length

  const bestRegionRec = latestRecords.reduce((best, r) =>
    r.avg_intensity_tco2_mwh < best.avg_intensity_tco2_mwh ? r : best, latestRecords[0])

  // YoY reduction: compare latest month to same month -12
  const targetMonth12Ago = (() => {
    const [y, m] = latestMonth.split('-').map(Number)
    return `${y - 1}-${String(m).padStart(2, '0')}`
  })()
  const prevRecords = data.regional.filter(r => r.month === targetMonth12Ago)
  const prevAvg = prevRecords.length > 0
    ? prevRecords.reduce((s, r) => s + r.avg_intensity_tco2_mwh, 0) / prevRecords.length
    : nemAvg
  const yoyReduction = ((prevAvg - nemAvg) / prevAvg) * 100

  const renewableShare = latestRecords.reduce((s, r) => s + r.renewable_pct, 0) / latestRecords.length

  // ---- Data transforms ----
  // Monthly emissions intensity by region (for LineChart)
  const months = [...new Set(data.regional.map(r => r.month))].sort()
  const lineChartData = months.map(m => {
    const row: Record<string, string | number> = { month: m }
    regions.forEach(reg => {
      const rec = data.regional.find(r => r.month === m && r.region === reg)
      if (rec) row[reg] = rec.avg_intensity_tco2_mwh
    })
    return row
  })

  // Generation mix evolution (AreaChart) - average across regions per month
  const genMixData = months.map(m => {
    const recs = data.regional.filter(r => r.month === m)
    const n = recs.length || 1
    return {
      month: m,
      Coal: +(recs.reduce((s, r) => s + r.coal_pct, 0) / n).toFixed(1),
      Gas: +(recs.reduce((s, r) => s + r.gas_pct, 0) / n).toFixed(1),
      Hydro: +(recs.reduce((s, r) => s + (100 - r.coal_pct - r.gas_pct - r.renewable_pct) * 0.4, 0) / n).toFixed(1),
      Wind: +(recs.reduce((s, r) => s + r.renewable_pct * 0.45, 0) / n).toFixed(1),
      Solar: +(recs.reduce((s, r) => s + r.renewable_pct * 0.40, 0) / n).toFixed(1),
      Other: +(recs.reduce((s, r) => s + r.renewable_pct * 0.15, 0) / n).toFixed(1),
    }
  })

  // Bar chart: marginal emissions by region + period
  const barData = regions.map(reg => {
    const row: Record<string, string | number> = { region: reg }
    data.time_of_day.filter(t => t.region === reg).forEach(t => {
      row[t.period] = t.marginal_intensity_tco2_mwh
    })
    return row
  })

  // Scatter chart: intensity vs price
  const scatterData = data.correlation.map(c => ({
    x: c.avg_price_aud_mwh,
    y: c.avg_intensity_tco2_mwh,
    z: c.generation_gwh,
    region: c.region,
  }))

  // Regional summary table
  const regionalSummary = regions.map(reg => {
    const recs = data.regional.filter(r => r.region === reg)
    const latest = recs.find(r => r.month === latestMonth)
    const avgIntensity = recs.reduce((s, r) => s + r.avg_intensity_tco2_mwh, 0) / recs.length
    const marginal = data.time_of_day.find(t => t.region === reg && t.period === 'PEAK')?.marginal_intensity_tco2_mwh ?? 0
    const first = recs.sort((a, b) => a.month.localeCompare(b.month))[0]
    const last = recs.sort((a, b) => a.month.localeCompare(b.month))[recs.length - 1]
    const trend = last.avg_intensity_tco2_mwh < first.avg_intensity_tco2_mwh ? 'declining' : last.avg_intensity_tco2_mwh > first.avg_intensity_tco2_mwh ? 'rising' : 'stable'
    return {
      region: reg,
      avgIntensity: avgIntensity.toFixed(3),
      marginal: marginal.toFixed(3),
      renewablePct: (latest?.renewable_pct ?? 0).toFixed(1),
      coalPct: (latest?.coal_pct ?? 0).toFixed(1),
      trend,
    }
  })

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <CloudRain size={28} className="text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Grid Emissions Intensity Analytics</h1>
          <p className="text-sm text-gray-400">Sprint 166a — GEIA Dashboard</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="NEM Avg Emissions Intensity"
          value={`${nemAvg.toFixed(3)} tCO2/MWh`}
          sub={`as of ${latestMonth}`}
          icon={CloudRain}
          color="bg-cyan-600"
        />
        <KpiCard
          title="Best Region (Lowest)"
          value={bestRegionRec.region}
          sub={`${bestRegionRec.avg_intensity_tco2_mwh.toFixed(3)} tCO2/MWh`}
          icon={Leaf}
          color="bg-emerald-600"
        />
        <KpiCard
          title="YoY Reduction"
          value={`${yoyReduction.toFixed(1)}%`}
          sub="emissions intensity decrease"
          icon={TrendingDown}
          color="bg-green-600"
        />
        <KpiCard
          title="Renewable Generation Share"
          value={`${renewableShare.toFixed(1)}%`}
          sub="NEM-wide average"
          icon={Flame}
          color="bg-amber-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly emissions intensity by region */}
        <ChartCard title="Monthly Emissions Intensity by NEM Region (tCO2/MWh)">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              {regions.map(reg => (
                <Line
                  key={reg}
                  type="monotone"
                  dataKey={reg}
                  stroke={REGION_COLOURS[reg]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Generation mix evolution */}
        <ChartCard title="Generation Mix Evolution (% share)">
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={genMixData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Area type="monotone" dataKey="Coal" stackId="1" fill="#6b7280" stroke="#6b7280" />
              <Area type="monotone" dataKey="Gas" stackId="1" fill="#f97316" stroke="#f97316" />
              <Area type="monotone" dataKey="Hydro" stackId="1" fill="#3b82f6" stroke="#3b82f6" />
              <Area type="monotone" dataKey="Wind" stackId="1" fill="#06b6d4" stroke="#06b6d4" />
              <Area type="monotone" dataKey="Solar" stackId="1" fill="#eab308" stroke="#eab308" />
              <Area type="monotone" dataKey="Other" stackId="1" fill="#a855f7" stroke="#a855f7" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Marginal emissions factor by region and time-of-day */}
        <ChartCard title="Marginal Emissions Factor by Region & Time-of-Day (tCO2/MWh)">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="PEAK" fill={PERIOD_COLOURS.PEAK} />
              <Bar dataKey="OFFPEAK" fill={PERIOD_COLOURS.OFFPEAK} />
              <Bar dataKey="SHOULDER" fill={PERIOD_COLOURS.SHOULDER} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Emissions intensity vs wholesale price */}
        <ChartCard title="Emissions Intensity vs Wholesale Price (bubble = generation GWh)">
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" dataKey="x" name="Price (AUD/MWh)" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name="Intensity (tCO2/MWh)" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <ZAxis type="number" dataKey="z" name="Generation (GWh)" range={[40, 400]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                formatter={(value: number, name: string) => [value.toFixed(2), name]}
              />
              <Legend />
              {regions.map(reg => (
                <Scatter
                  key={reg}
                  name={reg}
                  data={scatterData.filter(d => d.region === reg)}
                  fill={REGION_COLOURS[reg]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Regional emissions summary table */}
      <ChartCard title="Regional Emissions Summary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-2 pr-4">Region</th>
                <th className="py-2 pr-4">Avg Intensity</th>
                <th className="py-2 pr-4">Marginal Factor</th>
                <th className="py-2 pr-4">Renewable %</th>
                <th className="py-2 pr-4">Coal %</th>
                <th className="py-2 pr-4">Trend</th>
              </tr>
            </thead>
            <tbody>
              {regionalSummary.map(r => (
                <tr key={r.region} className="border-b border-gray-700/50">
                  <td className="py-2 pr-4 font-medium text-white">{r.region}</td>
                  <td className="py-2 pr-4">{r.avgIntensity}</td>
                  <td className="py-2 pr-4">{r.marginal}</td>
                  <td className="py-2 pr-4">{r.renewablePct}%</td>
                  <td className="py-2 pr-4">{r.coalPct}%</td>
                  <td className="py-2 pr-4"><TrendBadge trend={r.trend} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Top emitting generators table */}
      <div className="mt-6">
        <ChartCard title="Top Emitting Generators">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="py-2 pr-4">Generator</th>
                  <th className="py-2 pr-4">Fuel Type</th>
                  <th className="py-2 pr-4">Region</th>
                  <th className="py-2 pr-4">Capacity (MW)</th>
                  <th className="py-2 pr-4">Intensity (tCO2/MWh)</th>
                  <th className="py-2 pr-4">Annual Emissions (Mt)</th>
                </tr>
              </thead>
              <tbody>
                {data.generators.map(g => (
                  <tr key={g.generator_name} className="border-b border-gray-700/50">
                    <td className="py-2 pr-4 font-medium text-white">{g.generator_name}</td>
                    <td className="py-2 pr-4">{g.fuel_type}</td>
                    <td className="py-2 pr-4">{g.region}</td>
                    <td className="py-2 pr-4">{g.capacity_mw.toLocaleString()}</td>
                    <td className="py-2 pr-4">{g.intensity_tco2_mwh.toFixed(3)}</td>
                    <td className="py-2 pr-4">{g.annual_emissions_mt.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
