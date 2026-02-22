import { useEffect, useState } from 'react'
import { Wind } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, LineChart, Line,
} from 'recharts'
import {
  WFWEDashboard,
  getWindFarmWakeDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function KpiCard({ title, value, sub, color }: { title: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{title}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

const DIRECTION_LABELS: Record<number, string> = {
  0: 'N', 45: 'NE', 90: 'E', 135: 'SE',
  180: 'S', 225: 'SW', 270: 'W', 315: 'NW',
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function WindFarmWakeAnalytics() {
  const [data, setData] = useState<WFWEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWindFarmWakeDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <Wind className="animate-spin mr-2" size={24} />
        Loading Wind Farm Wake Effect data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        Error: {error ?? 'Unknown error'}
      </div>
    )
  }

  const { farms, turbines, wake_losses, layout_optimisations, maintenance, performance, summary } = data

  // --- Chart data: Wake loss by wind direction (averaged across farms) ---
  const directionMap: Record<number, { losses: number[]; freqs: number[] }> = {}
  wake_losses.forEach(wl => {
    const dir = wl.wind_direction_deg
    if (!directionMap[dir]) directionMap[dir] = { losses: [], freqs: [] }
    directionMap[dir].losses.push(wl.wake_loss_pct)
    directionMap[dir].freqs.push(wl.wind_frequency_pct)
  })
  const wakeByDirection = Object.entries(directionMap)
    .map(([dir, { losses, freqs }]) => ({
      direction: DIRECTION_LABELS[Number(dir)] ?? `${dir}°`,
      avg_wake_loss: Number((losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(2)),
      avg_wind_freq: Number((freqs.reduce((a, b) => a + b, 0) / freqs.length).toFixed(1)),
    }))
    .sort((a, b) => {
      const order = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
      return order.indexOf(a.direction) - order.indexOf(b.direction)
    })

  // --- Chart data: Layout optimisation comparison (Farm 1) ---
  const farm1Id = farms[0]?.farm_id
  const layoutData = layout_optimisations
    .filter(o => o.farm_id === farm1Id)
    .map(o => ({
      scenario: o.scenario_name,
      net_aep: o.net_aep_gwh,
      wake_loss: o.wake_loss_pct,
      improvement: o.aep_improvement_pct_vs_baseline,
    }))

  // --- Scatter: turbine wake deficit vs distance ---
  const scatterData = turbines.map(t => ({
    distance: t.distance_to_nearest_turbine_m,
    deficit: t.wake_deficit_pct,
    wake_affected: t.wake_affected ? 1 : 0,
  }))

  // --- Line: Monthly performance for Farm 1 ---
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
  const perfData = performance
    .filter(p => p.farm_id === farm1Id)
    .sort((a, b) => a.month - b.month)
    .map((p, i) => ({
      month: monthNames[i] ?? `M${p.month}`,
      performance_ratio: p.performance_ratio_pct,
      capacity_factor: p.capacity_factor_pct,
      benchmark: p.benchmark_capacity_factor_pct,
    }))

  // --- Wake-related maintenance count ---
  const wakeRelatedCount = maintenance.filter(m => m.caused_by_wake).length

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Wind size={32} className="text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Wind Farm Wake Effect Analytics</h1>
          <p className="text-sm text-gray-400">
            Wake loss modelling, layout optimisation & performance benchmarking
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Wind Capacity"
          value={`${(summary.total_wind_capacity_gw ?? 0).toFixed(2)} GW`}
          sub={`${farms.length} farms`}
          color="text-cyan-400"
        />
        <KpiCard
          title="Avg Wake Loss"
          value={`${(summary.avg_wake_loss_pct ?? 0).toFixed(1)}%`}
          sub="Gross to net"
          color="text-amber-400"
        />
        <KpiCard
          title="AEP Loss (GWh/yr)"
          value={`${(summary.total_aep_loss_gwh_pa ?? 0).toLocaleString()}`}
          sub="Across all farms"
          color="text-rose-400"
        />
        <KpiCard
          title="Best Layout Gain"
          value={`+${(summary.best_layout_improvement_pct ?? 0).toFixed(1)}%`}
          sub="vs baseline"
          color="text-emerald-400"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Wake Loss by Wind Direction */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Wake Loss % by Wind Direction Sector
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={wakeByDirection} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" domain={[0, 25]} unit="%" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis dataKey="direction" type="category" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={30} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6' }}
                formatter={(v: number) => [`${v.toFixed(2)}%`]}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Bar dataKey="avg_wake_loss" name="Avg Wake Loss %" fill="#22D3EE" radius={[0, 4, 4, 0]} />
              <Bar dataKey="avg_wind_freq" name="Wind Frequency %" fill="#6366F1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Layout Optimisation Comparison */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Layout Optimisation — Net AEP & Wake Loss ({farms[0]?.farm_name ?? 'Farm 1'})
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={layoutData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="scenario" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6' }}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="net_aep" name="Net AEP (GWh)" fill="#10B981" />
              <Bar yAxisId="right" dataKey="wake_loss" name="Wake Loss %" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Scatter: Turbine Wake Deficit vs Distance */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Turbine Wake Deficit vs Distance to Nearest Turbine
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="distance"
                name="Distance (m)"
                unit="m"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                label={{ value: 'Distance (m)', fill: '#9CA3AF', fontSize: 11, position: 'insideBottom', offset: -4 }}
              />
              <YAxis
                dataKey="deficit"
                name="Wake Deficit %"
                unit="%"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6' }}
                cursor={{ strokeDasharray: '3 3' }}
              />
              <Scatter
                data={scatterData}
                name="Turbines"
                fill="#F472B6"
                fillOpacity={0.75}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Line: Monthly Performance */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Monthly Performance Ratio & Capacity Factor ({farms[0]?.farm_name ?? 'Farm 1'})
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={perfData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis domain={[50, 120]} unit="%" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`]}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Line type="monotone" dataKey="performance_ratio" name="Performance Ratio %" stroke="#22D3EE" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="capacity_factor" name="Capacity Factor %" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="benchmark" name="Benchmark CF %" stroke="#6366F1" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Farm Overview Table */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Farm Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="pb-2 pr-3">Farm</th>
                  <th className="pb-2 pr-3">State</th>
                  <th className="pb-2 pr-3">Tech</th>
                  <th className="pb-2 pr-3">Capacity (MW)</th>
                  <th className="pb-2 pr-3">Wake Loss %</th>
                  <th className="pb-2">Net AEP (GWh)</th>
                </tr>
              </thead>
              <tbody>
                {farms.map(f => (
                  <tr key={f.farm_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-3 text-white font-medium truncate max-w-[120px]">{f.farm_name}</td>
                    <td className="py-2 pr-3 text-gray-300">{f.state}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${f.technology === 'Offshore' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                        {f.technology}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-cyan-400">{f.total_capacity_mw.toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      <span className={`font-semibold ${f.wake_loss_pct > 10 ? 'text-rose-400' : f.wake_loss_pct > 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {f.wake_loss_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 text-gray-300">{f.net_aep_gwh.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance Issues Table */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">
            Top Maintenance Issues
            <span className="ml-2 text-xs text-rose-400">({wakeRelatedCount} wake-related)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Component</th>
                  <th className="pb-2 pr-3">Downtime (h)</th>
                  <th className="pb-2 pr-3">Energy Lost (MWh)</th>
                  <th className="pb-2">Wake?</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.slice(0, 15).map(m => (
                  <tr key={m.maint_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        m.maintenance_type === 'Corrective' ? 'bg-rose-900 text-rose-300'
                        : m.maintenance_type === 'Predictive' ? 'bg-amber-900 text-amber-300'
                        : 'bg-gray-700 text-gray-300'
                      }`}>
                        {m.maintenance_type}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-300">{m.component}</td>
                    <td className="py-2 pr-3 text-amber-400">{m.downtime_hours.toFixed(0)}</td>
                    <td className="py-2 pr-3 text-rose-400">{m.energy_lost_mwh.toFixed(1)}</td>
                    <td className="py-2">
                      {m.caused_by_wake
                        ? <span className="text-xs font-bold text-rose-400">Yes</span>
                        : <span className="text-xs text-gray-500">No</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
