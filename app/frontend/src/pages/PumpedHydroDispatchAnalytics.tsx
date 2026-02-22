import { useEffect, useState } from 'react'
import { Droplets, Zap, Database, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getPumpedHydroDispatchDashboard } from '../api/client'
import type { PHDADashboard, PHDAStationRecord, PHDAProjectRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Helper components
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
  sub: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    'Pre-FEED': 'bg-gray-600 text-gray-200',
    'FEED': 'bg-blue-700 text-blue-100',
    'Approved': 'bg-yellow-700 text-yellow-100',
    'Construction': 'bg-orange-700 text-orange-100',
    'Operating': 'bg-green-700 text-green-100',
  }
  const cls = colors[stage] ?? 'bg-gray-700 text-gray-200'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{stage}</span>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function PumpedHydroDispatchAnalytics() {
  const [data, setData] = useState<PHDADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPumpedHydroDispatchDashboard()
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-400">
        <RefreshCw size={20} className="animate-spin mr-2" />
        Loading Pumped Hydro Dispatch data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400 gap-2">
        <AlertTriangle size={20} />
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const { summary, stations, storage_levels, dispatch_records, water_values, optimisations, projects } = data

  // -------------------------------------------------------------------------
  // Chart data — storage level trend by station
  // -------------------------------------------------------------------------
  const storageStationIds = ['TUMUT3', 'WIVENHOE', 'SHOALHAVEN', 'HUME', 'BLOWERING']
  const storageByDate: Record<string, Record<string, number>> = {}
  for (const rec of storage_levels) {
    if (!storageByDate[rec.date]) storageByDate[rec.date] = {}
    storageByDate[rec.date][rec.station_id] = rec.upper_level_pct
  }
  const storageTrendData = Object.entries(storageByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date: date.slice(5), ...vals }))

  const stationColors = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#fb7185']

  // -------------------------------------------------------------------------
  // Chart data — dispatch revenue by mode per station
  // -------------------------------------------------------------------------
  const revenueByStation: Record<string, Record<string, number>> = {}
  for (const rec of dispatch_records) {
    if (!revenueByStation[rec.station_id]) {
      revenueByStation[rec.station_id] = { Generating: 0, Pumping: 0, FCAS: 0, Standby: 0 }
    }
    revenueByStation[rec.station_id][rec.mode] =
      (revenueByStation[rec.station_id][rec.mode] ?? 0) + rec.revenue_aud
  }
  const dispatchRevenueData = Object.entries(revenueByStation).map(([sid, modes]) => ({
    station: sid,
    Generating: Math.round(modes.Generating ?? 0),
    Pumping: Math.round(Math.abs(modes.Pumping ?? 0)),
    FCAS: Math.round(modes.FCAS ?? 0),
  }))

  // -------------------------------------------------------------------------
  // Chart data — water value by storage level (scenario curves)
  // -------------------------------------------------------------------------
  const wvByScenario: Record<string, { storage_pct: number; wv: number }[]> = {}
  for (const rec of water_values) {
    if (!wvByScenario[rec.scenario]) wvByScenario[rec.scenario] = []
    wvByScenario[rec.scenario].push({ storage_pct: rec.storage_level_pct, wv: rec.water_value_dolpermwh })
  }
  // Build combined array sorted by storage_pct for Wet/Dry/Median
  const wvScenarioKeys = ['Wet', 'Dry', 'Median', 'Current']
  const wvAllPoints = [...water_values]
    .sort((a, b) => a.storage_level_pct - b.storage_level_pct)
    .map((r) => ({ pct: Math.round(r.storage_level_pct), [r.scenario]: r.water_value_dolpermwh }))
  // Merge points by pct
  const wvMerged: Record<number, Record<string, number>> = {}
  for (const pt of wvAllPoints) {
    const { pct, ...rest } = pt
    if (!wvMerged[pct]) wvMerged[pct] = { pct }
    Object.assign(wvMerged[pct], rest)
  }
  const wvChartData = Object.values(wvMerged).sort((a, b) => a.pct - b.pct)

  // -------------------------------------------------------------------------
  // Chart data — optimisation strategy comparison
  // -------------------------------------------------------------------------
  const optByStrategy: Record<string, { revenue: number; missed: number; count: number }> = {}
  for (const rec of optimisations) {
    if (!optByStrategy[rec.strategy]) optByStrategy[rec.strategy] = { revenue: 0, missed: 0, count: 0 }
    optByStrategy[rec.strategy].revenue += rec.annual_revenue_m
    optByStrategy[rec.strategy].missed += rec.missed_opportunity_pct
    optByStrategy[rec.strategy].count += 1
  }
  const optChartData = Object.entries(optByStrategy).map(([strategy, vals]) => ({
    strategy,
    avg_revenue_m: Math.round((vals.revenue / vals.count) * 10) / 10,
    avg_missed_pct: Math.round((vals.missed / vals.count) * 10) / 10,
  }))

  // -------------------------------------------------------------------------
  // Operating stations for the table
  // -------------------------------------------------------------------------
  const operatingStations: PHDAStationRecord[] = stations.filter((s) => s.status === 'Operating')

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue-700">
          <Droplets size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Pumped Hydro Dispatch Optimisation Analytics</h1>
          <p className="text-sm text-gray-400">Water value optimisation, dispatch strategy and PHES project pipeline</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Generating Capacity"
          value={`${(Number(summary.total_generating_capacity_gw) ?? 0).toFixed(1)} GW`}
          sub="Total installed PHES turbine capacity"
          icon={Zap}
          color="bg-blue-600"
        />
        <KpiCard
          title="Total Storage"
          value={`${(Number(summary.total_storage_gwh) ?? 0).toFixed(0)} GWh`}
          sub="Across all active & pipeline projects"
          icon={Database}
          color="bg-teal-600"
        />
        <KpiCard
          title="Avg Round-Trip Eff."
          value={`${(Number(summary.avg_round_trip_efficiency_pct) ?? 0).toFixed(1)}%`}
          sub="Operating stations (weighted)"
          icon={TrendingUp}
          color="bg-purple-600"
        />
        <KpiCard
          title="Pipeline Capacity"
          value={`${(Number(summary.projects_pipeline_gw) ?? 0).toFixed(1)} GW`}
          sub="Construction + planned PHES"
          icon={Droplets}
          color="bg-amber-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Storage level trend */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Storage Level Trend — % Capacity (Operating Stations)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={storageTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {storageStationIds.map((sid, i) => (
                <Line
                  key={sid}
                  type="monotone"
                  dataKey={sid}
                  stroke={stationColors[i]}
                  dot={false}
                  strokeWidth={2}
                  name={sid}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Dispatch revenue by mode */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Dispatch Revenue by Mode per Station (AUD)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dispatchRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="station" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="Generating" fill="#60a5fa" name="Generating" />
              <Bar dataKey="Pumping" fill="#f59e0b" name="Pumping (cost abs)" />
              <Bar dataKey="FCAS" fill="#34d399" name="FCAS" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Water value by storage level */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Water Value vs Storage Level — Scenario Curves ($/MWh)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={wvChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="pct" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="$" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {wvScenarioKeys.map((sc, i) => (
                <Line
                  key={sc}
                  type="monotone"
                  dataKey={sc}
                  stroke={stationColors[i]}
                  dot={false}
                  strokeWidth={2}
                  name={sc}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Optimisation strategy comparison */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Optimisation Strategy — Avg Revenue & Missed Opportunity</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={optChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="strategy" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="avg_revenue_m" fill="#60a5fa" name="Avg Revenue ($M)" />
              <Bar yAxisId="right" dataKey="avg_missed_pct" fill="#fb7185" name="Avg Missed Opp. %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Station overview table */}
      <div className="bg-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Station Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Station</th>
                <th className="text-left py-2 pr-4">Owner</th>
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">Turbine MW</th>
                <th className="text-right py-2 pr-4">Pump MW</th>
                <th className="text-right py-2 pr-4">Upper Res (GL)</th>
                <th className="text-right py-2 pr-4">Head (m)</th>
                <th className="text-right py-2 pr-4">RTE %</th>
                <th className="text-right py-2 pr-4">Black Start</th>
                <th className="text-right py-2">FCAS</th>
              </tr>
            </thead>
            <tbody>
              {operatingStations.map((s) => (
                <tr key={s.station_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{s.station_name}</td>
                  <td className="py-2 pr-4">{s.owner}</td>
                  <td className="py-2 pr-4">{s.region}</td>
                  <td className="py-2 pr-4 text-right">{s.turbine_capacity_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right">{s.pump_capacity_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right">{s.upper_reservoir_gl.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right">{s.head_m}</td>
                  <td className="py-2 pr-4 text-right">
                    {s.round_trip_efficiency_pct > 0 ? `${s.round_trip_efficiency_pct}%` : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {s.black_start_capable ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {s.fcas_capable ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PHES project pipeline table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">PHES Project Pipeline</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">Project</th>
                <th className="text-left py-2 pr-4">Developer</th>
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">MW</th>
                <th className="text-right py-2 pr-4">GWh</th>
                <th className="text-right py-2 pr-4">Head (m)</th>
                <th className="text-right py-2 pr-4">Cost ($Bn)</th>
                <th className="text-right py-2 pr-4">Commissioning</th>
                <th className="text-left py-2 pr-4">Stage</th>
                <th className="text-right py-2 pr-4">Env. Approval</th>
                <th className="text-right py-2">Grid Agreed</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p: PHDAProjectRecord) => (
                <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{p.project_name}</td>
                  <td className="py-2 pr-4">{p.developer}</td>
                  <td className="py-2 pr-4">{p.region}</td>
                  <td className="py-2 pr-4 text-right">{p.turbine_capacity_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right">{p.storage_gwh}</td>
                  <td className="py-2 pr-4 text-right">{p.head_m}</td>
                  <td className="py-2 pr-4 text-right">{p.construction_cost_bn}</td>
                  <td className="py-2 pr-4 text-right">{p.commissioning_year}</td>
                  <td className="py-2 pr-4">
                    <StageBadge stage={p.stage} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {p.environmental_approval ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-red-400">No</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {p.grid_connection_agreed ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-red-400">No</span>
                    )}
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
