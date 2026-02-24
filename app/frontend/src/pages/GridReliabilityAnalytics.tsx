import { useEffect, useState } from 'react'
import { Wifi, AlertTriangle, Activity, Shield, Zap } from 'lucide-react'
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
  ScatterChart,
  Scatter,
} from 'recharts'
import { getGridReliabilityDashboard } from '../api/client'
import type { GRPTDashboard } from '../api/client'

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
// Chart section wrapper
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

const REGION_COLORS: Record<string, string> = {
  NSW: '#22d3ee',
  QLD: '#f59e0b',
  VIC: '#34d399',
  SA: '#ef4444',
  WA: '#a78bfa',
  TAS: '#fb923c',
}

const INCIDENT_COLORS: Record<string, string> = {
  'Equipment Failure': '#ef4444',
  'Extreme Weather': '#f59e0b',
  'Bushfire': '#fb923c',
  'Flood': '#22d3ee',
  'Cyber': '#a78bfa',
  'Human Error': '#34d399',
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GridReliabilityAnalytics() {
  const [data, setData] = useState<GRPTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGridReliabilityDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Grid Reliability data…</p>
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

  const { summary, region_metrics, incidents, assets, benchmarks } = data

  // ── Chart 1: Annual SAIDI trend 2022-2024 by region ────────────────────────
  // Average SAIDI per region per year across all quarters
  const saidiByRegionYear: Record<string, Record<number, number[]>> = {}
  for (const m of region_metrics) {
    if (!saidiByRegionYear[m.region]) saidiByRegionYear[m.region] = {}
    if (!saidiByRegionYear[m.region][m.year]) saidiByRegionYear[m.region][m.year] = []
    saidiByRegionYear[m.region][m.year].push(m.saidi_minutes)
  }
  const saidiTrendData = [2022, 2023, 2024].map((year) => {
    const entry: Record<string, number | string> = { year: String(year) }
    for (const region of ['NSW', 'QLD', 'VIC', 'SA', 'WA', 'TAS']) {
      const vals = saidiByRegionYear[region]?.[year] ?? []
      entry[region] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
    }
    return entry
  })

  // ── Chart 2: Incident count by incident_type (all years) ──────────────────
  const incidentTypeCounts: Record<string, number> = {}
  for (const inc of incidents) {
    incidentTypeCounts[inc.incident_type] = (incidentTypeCounts[inc.incident_type] ?? 0) + 1
  }
  const incidentTypeData = Object.entries(incidentTypeCounts).map(([type, count]) => ({
    type,
    count,
  }))

  // ── Chart 3: Asset condition_score by asset_class (avg per region) ─────────
  const assetConditionMap: Record<string, Record<string, number[]>> = {}
  for (const a of assets) {
    if (!assetConditionMap[a.asset_class]) assetConditionMap[a.asset_class] = {}
    if (!assetConditionMap[a.asset_class][a.region]) assetConditionMap[a.asset_class][a.region] = []
    assetConditionMap[a.asset_class][a.region].push(a.condition_score)
  }
  const assetConditionData = Object.entries(assetConditionMap).map(([assetClass, byRegion]) => {
    const entry: Record<string, number | string> = { asset_class: assetClass }
    for (const region of ['NSW', 'QLD', 'VIC', 'SA', 'WA', 'TAS']) {
      const vals = byRegion[region] ?? []
      entry[region] = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : 0
    }
    return entry
  })

  // ── Chart 4: region_saidi vs national_avg vs best_practice for 2024 ────────
  const benchmarks2024 = benchmarks.filter((b) => b.year === 2024)
  const benchmarkData = benchmarks2024.map((b) => ({
    region: b.region,
    region_saidi: b.region_saidi,
    national_avg: b.national_avg_saidi,
    best_practice: b.best_practice_saidi,
  }))

  // ── Chart 5: Avg unserved_energy_mwh per incident by region (2024) ─────────
  const unservedByRegion: Record<string, number[]> = {}
  for (const inc of incidents.filter((i) => i.year === 2024)) {
    if (!unservedByRegion[inc.region]) unservedByRegion[inc.region] = []
    unservedByRegion[inc.region].push(inc.unserved_energy_mwh)
  }
  const unservedData = Object.entries(unservedByRegion).map(([region, vals]) => ({
    region,
    avg_unserved: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-cyan-600">
          <Wifi size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Grid Reliability Performance Tracker</h1>
          <p className="text-xs text-gray-400">SAIDI · SAIFI · CAIDI · Incident Analysis · Asset Health · 2022–2024</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Avg SAIDI 2024 (minutes)"
          value={summary.avg_saidi_2024.toFixed(1)}
          sub="System Average Interruption Duration"
          icon={Activity}
          color="bg-cyan-600"
        />
        <KpiCard
          title="Total Incidents 2024"
          value={String(summary.total_incidents_2024)}
          sub="Across all regions"
          icon={AlertTriangle}
          color="bg-amber-600"
        />
        <KpiCard
          title="Unserved Energy 2024 (MWh)"
          value={summary.unserved_energy_2024_mwh.toFixed(2)}
          sub="Total from incidents"
          icon={Zap}
          color="bg-red-600"
        />
        <KpiCard
          title="Reliability Compliance"
          value={`${summary.reliability_compliance_pct.toFixed(1)}%`}
          sub="Targets met (SAIDI < 120 min)"
          icon={Shield}
          color="bg-emerald-600"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: SAIDI Trend */}
        <ChartCard title="Annual SAIDI Trend by Region (2022–2024)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={saidiTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" min" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {['NSW', 'QLD', 'VIC', 'SA', 'WA', 'TAS'].map((region) => (
                <Line
                  key={region}
                  type="monotone"
                  dataKey={region}
                  stroke={REGION_COLORS[region]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Incident count by type */}
        <ChartCard title="Incident Count by Type (All Years)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={incidentTypeData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="type"
                stroke="#9ca3af"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                angle={-30}
                textAnchor="end"
              />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]}>
                {incidentTypeData.map((entry) => (
                  <rect
                    key={entry.type}
                    fill={INCIDENT_COLORS[entry.type] ?? '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: Asset condition by class per region */}
        <ChartCard title="Asset Condition Score by Class & Region (Avg)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={assetConditionData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="asset_class"
                stroke="#9ca3af"
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                angle={-20}
                textAnchor="end"
              />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 10]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {['NSW', 'QLD', 'VIC', 'SA', 'WA', 'TAS'].map((region) => (
                <Bar key={region} dataKey={region} stackId="a" fill={REGION_COLORS[region]} name={region} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Benchmark comparison 2024 */}
        <ChartCard title="SAIDI Benchmark: Region vs National Avg vs Best Practice (2024)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={benchmarkData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" min" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="region_saidi" name="Region SAIDI" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              <Bar dataKey="national_avg" name="National Avg" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="best_practice" name="Best Practice" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Avg unserved energy per incident by region (2024) */}
        <ChartCard title="Avg Unserved Energy per Incident by Region (2024, MWh)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={unservedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" MWh" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Bar dataKey="avg_unserved" name="Avg Unserved Energy" radius={[4, 4, 0, 0]}>
                {unservedData.map((entry) => (
                  <rect
                    key={entry.region}
                    fill={REGION_COLORS[entry.region] ?? '#6b7280'}
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
