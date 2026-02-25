import { useEffect, useState } from 'react'
import { Shield, Activity, Zap, TrendingDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  Cell,
} from 'recharts'
import { getBatteryChemistryRiskDashboard } from '../api/client'
import type { BCRAdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const CHEMISTRY_COLOURS: Record<string, string> = {
  'LFP':          '#3b82f6',
  'NMC':          '#f59e0b',
  'NCA':          '#ef4444',
  'LTO':          '#10b981',
  'Sodium-Ion':   '#8b5cf6',
  'Flow Battery': '#06b6d4',
}

const RISK_COLOURS: Record<string, string> = {
  'Thermal':       '#ef4444',
  'Chemical':      '#f97316',
  'Electrical':    '#eab308',
  'Operational':   '#3b82f6',
  'Environmental': '#22c55e',
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
export default function BatteryChemistryRiskAnalytics() {
  const [data, setData] = useState<BCRAdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBatteryChemistryRiskDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Battery Chemistry Risk Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">Error: {error ?? 'No data'}</p>
      </div>
    )
  }

  const { chemistries, deployments, risks, performance, summary } = data

  // -----------------------------------------------------------------------
  // Chart 1: Energy density vs cycle life by chemistry (normalised)
  // -----------------------------------------------------------------------
  const maxEnergyDensity = Math.max(...chemistries.map(c => c.energy_density_wh_kg))
  const maxCycleLife = Math.max(...chemistries.map(c => c.cycle_life))

  const energyCycleData = chemistries.map(c => ({
    name: c.chemistry_name,
    energy_density_norm: Math.round((c.energy_density_wh_kg / maxEnergyDensity) * 100),
    cycle_life_norm: Math.round((c.cycle_life / maxCycleLife) * 100),
  }))

  // -----------------------------------------------------------------------
  // Chart 2: Deployment capacity MWh by site (sorted desc, top 12)
  // -----------------------------------------------------------------------
  const deploymentCapacityData = [...deployments]
    .sort((a, b) => b.capacity_mwh - a.capacity_mwh)
    .slice(0, 12)
    .map(d => ({
      name: d.site_name.length > 18 ? d.site_name.slice(0, 17) + '…' : d.site_name,
      capacity_mwh: d.capacity_mwh,
      chemistry: d.chemistry,
    }))

  // -----------------------------------------------------------------------
  // Chart 3: Risk score by chemistry and risk category (heatmap-style grouped bar)
  // -----------------------------------------------------------------------
  const riskCategories = ['Thermal', 'Chemical', 'Electrical', 'Operational', 'Environmental']
  const chemNames = ['LFP', 'NMC', 'NCA', 'LTO', 'Sodium-Ion', 'Flow Battery']

  const riskHeatmapData = chemNames.map(chem => {
    const entry: Record<string, string | number> = { chemistry: chem }
    for (const cat of riskCategories) {
      const rec = risks.find(r => r.chemistry === chem && r.risk_category === cat)
      entry[cat] = rec ? Math.round(rec.risk_score * 10) / 10 : 0
    }
    return entry
  })

  // -----------------------------------------------------------------------
  // Chart 4: State of health % trend by chemistry (2024 quarters, averaged)
  // -----------------------------------------------------------------------
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']

  // Map site_id -> chemistry
  const siteChemMap: Record<string, string> = {}
  for (const d of deployments) {
    siteChemMap[d.site_id] = d.chemistry
  }

  const sohTrendData = quarters.map(quarter => {
    const entry: Record<string, string | number> = { quarter }
    for (const chem of chemNames) {
      const recs = performance.filter(
        p => p.quarter === quarter && p.year === 2024 && siteChemMap[p.site_id] === chem
      )
      if (recs.length > 0) {
        const avg = recs.reduce((acc, r) => acc + r.state_of_health_pct, 0) / recs.length
        entry[chem] = Math.round(avg * 10) / 10
      } else {
        entry[chem] = null as unknown as number
      }
    }
    return entry
  })

  // -----------------------------------------------------------------------
  // Chart 5: Insurance premium % by chemistry (averaged from risk records)
  // -----------------------------------------------------------------------
  const insuranceData = chemNames.map(chem => {
    const recs = risks.filter(r => r.chemistry === chem)
    const avg = recs.length > 0
      ? recs.reduce((acc, r) => acc + r.insurance_premium_pct, 0) / recs.length
      : 0
    return {
      name: chem,
      avg_premium_pct: Math.round(avg * 100) / 100,
    }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-red-700 px-6 py-5">
        <div className="flex items-center gap-3">
          <Shield size={28} className="text-white" />
          <div>
            <h1 className="text-xl font-bold text-white">Battery Chemistry Risk Analytics</h1>
            <p className="text-red-200 text-sm mt-0.5">
              Comparative safety, deployment risk, and performance metrics across BESS chemistries
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Deployments"
            value={summary.total_deployments.toString()}
            sub="Active BESS sites"
            icon={Activity}
            color="bg-red-700"
          />
          <KpiCard
            title="Total Capacity"
            value={`${summary.total_capacity_mwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} MWh`}
            sub="Across all sites"
            icon={Zap}
            color="bg-blue-600"
          />
          <KpiCard
            title="Safest Chemistry"
            value={summary.safest_chemistry}
            sub="Lowest avg risk score"
            icon={Shield}
            color="bg-green-600"
          />
          <KpiCard
            title="Avg Degradation"
            value={`${summary.avg_degradation_pct_per_year.toFixed(2)}% / yr`}
            sub="Fleet average"
            icon={TrendingDown}
            color="bg-orange-600"
          />
        </div>

        {/* Chart 1: Energy Density vs Cycle Life */}
        <ChartCard title="Energy Density vs Cycle Life by Chemistry (Normalised to 100)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={energyCycleData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="energy_density_norm" name="Energy Density" fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="cycle_life_norm" name="Cycle Life" fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Deployment Capacity by Site (horizontal) */}
        <ChartCard title="Deployment Capacity MWh by Site (Top 12, sorted descending)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              layout="vertical"
              data={deploymentCapacityData}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWh" />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={130}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v} MWh`, 'Capacity']}
              />
              <Bar dataKey="capacity_mwh" name="Capacity MWh" radius={[0,3,3,0]}>
                {deploymentCapacityData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHEMISTRY_COLOURS[entry.chemistry] ?? '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Risk Score Heatmap (grouped bar) */}
        <ChartCard title="Risk Score by Chemistry and Risk Category (Severity × Likelihood)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={riskHeatmapData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="chemistry" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {riskCategories.map(cat => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  name={cat}
                  fill={RISK_COLOURS[cat]}
                  radius={[2,2,0,0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: State of Health Trend */}
        <ChartCard title="State of Health % Trend by Chemistry (2024, averaged across deployments)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={sohTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                unit="%"
                domain={[75, 100]}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v}%`, '']}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {chemNames.map(chem => (
                <Line
                  key={chem}
                  type="monotone"
                  dataKey={chem}
                  name={chem}
                  stroke={CHEMISTRY_COLOURS[chem]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Insurance Premium by Chemistry */}
        <ChartCard title="Average Insurance Premium % by Chemistry (from risk records)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={insuranceData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`${v}%`, 'Avg Premium']}
              />
              <Bar dataKey="avg_premium_pct" name="Avg Premium %" radius={[4,4,0,0]}>
                {insuranceData.map((entry, index) => (
                  <Cell
                    key={`ins-cell-${index}`}
                    fill={CHEMISTRY_COLOURS[entry.name] ?? '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
