import { useEffect, useState } from 'react'
import { Wind } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis,
  LineChart, Line,
  ResponsiveContainer,
} from 'recharts'
import {
  getWindFarmWakeEffectDashboard,
  WFWEXDashboard,
  WFWEXFarmRecord,
  WFWEXWakeLoss,
  WFWEXOptimisation,
  WFWEXPerformanceTrend,
  WFWEXTechnology,
} from '../api/client'

const MATURITY_COLOUR: Record<string, string> = {
  Commercial: '#22c55e',
  Emerging:   '#f59e0b',
  'R&D':      '#ef4444',
}

export default function WindFarmWakeEffectAnalytics() {
  const [data, setData] = useState<WFWEXDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWindFarmWakeEffectDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <div className="p-6 text-red-500">Error: {error}</div>
  if (!data)  return <div className="p-6 text-gray-400">Loading...</div>

  const summary = data.summary as Record<string, unknown>

  // Chart 1: wake_loss_pct by farm_name sorted desc
  const farmWakeSorted = [...data.farms]
    .sort((a: WFWEXFarmRecord, b: WFWEXFarmRecord) => b.wake_loss_pct - a.wake_loss_pct)
    .map((f: WFWEXFarmRecord) => ({
      name:      f.farm_name.replace(' Wind Farm', '').replace(' Wind Energy', ''),
      wake_loss: f.wake_loss_pct,
    }))

  // Chart 2: wake_loss_pct by wind_direction for top 3 farms (sorted by wake_loss desc)
  const top3 = [...data.farms]
    .sort((a, b) => b.wake_loss_pct - a.wake_loss_pct)
    .slice(0, 3)
    .map((f) => f.farm_name)
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const radarData = DIRS.map((dir) => {
    const row: Record<string, string | number> = { direction: dir }
    top3.forEach((fname) => {
      const rec = data.wake_losses.find(
        (w: WFWEXWakeLoss) => w.farm_name === fname && w.wind_direction === dir,
      )
      row[fname.replace(' Wind Farm', '').replace(' Wind Energy', '')] = rec ? rec.wake_loss_pct : 0
    })
    return row
  })
  const top3Short = top3.map((n) => n.replace(' Wind Farm', '').replace(' Wind Energy', ''))
  const RADAR_COLOURS = ['#6366f1', '#22d3ee', '#f59e0b']

  // Chart 3: scatter — revenue_gain_m vs implementation_cost_m, size = energy_gain_gwh
  const scatterData = data.optimisations.map((o: WFWEXOptimisation) => ({
    x:    o.implementation_cost_m,
    y:    o.revenue_gain_m,
    z:    o.energy_gain_gwh,
    name: o.farm_name,
    type: o.optimisation_type,
  }))

  // Chart 4: line — capacity_factor_pct by year for 5 farms
  const line5 = [
    ...new Set(data.performance_trends.map((p: WFWEXPerformanceTrend) => p.farm_name)),
  ].slice(0, 5)
  const years = [2020, 2021, 2022, 2023, 2024]
  const lineData = years.map((yr) => {
    const row: Record<string, string | number> = { year: String(yr) }
    line5.forEach((fname) => {
      const rec = data.performance_trends.find(
        (p: WFWEXPerformanceTrend) => p.farm_name === fname && p.year === yr,
      )
      row[fname.replace(' Wind Farm', '').replace(' Wind Energy', '')] = rec
        ? rec.capacity_factor_pct
        : 0
    })
    return row
  })
  const line5Short = line5.map((n) => n.replace(' Wind Farm', '').replace(' Wind Energy', ''))
  const LINE_COLOURS = ['#6366f1', '#22d3ee', '#f59e0b', '#22c55e', '#ef4444']

  // Chart 5: bar — energy_uplift_pct by technology coloured by maturity
  const techData = data.technologies.map((t: WFWEXTechnology) => ({
    name:    t.technology.length > 22 ? t.technology.slice(0, 22) + '…' : t.technology,
    uplift:  t.energy_uplift_pct,
    fill:    MATURITY_COLOUR[t.maturity] ?? '#94a3b8',
    maturity: t.maturity,
  }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wind className="w-8 h-8 text-cyan-400" />
        <h1 className="text-2xl font-bold text-white">
          Wind Farm Wake Effect &amp; Layout Optimisation Analytics
        </h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Total Installed Capacity</p>
          <p className="text-2xl font-bold text-cyan-400">
            {(summary.total_installed_capacity_gw as number).toFixed(2)} GW
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Avg Wake Loss</p>
          <p className="text-2xl font-bold text-amber-400">
            {(summary.avg_wake_loss_pct as number).toFixed(1)} %
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Max Energy Gain Potential</p>
          <p className="text-2xl font-bold text-green-400">
            {(summary.max_energy_gain_potential_gwh as number).toFixed(1)} GWh
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">Avg Capacity Factor</p>
          <p className="text-2xl font-bold text-indigo-400">
            {(summary.avg_capacity_factor_pct as number).toFixed(1)} %
          </p>
        </div>
      </div>

      {/* Chart 1: Wake Loss by Farm */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-4">
          Wake Loss % by Farm (Descending)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={farmWakeSorted} margin={{ top: 8, right: 16, bottom: 80, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="wake_loss" name="Wake Loss %" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Wake Loss by Wind Direction for Top 3 Farms */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-4">
          Wake Loss % by Wind Direction — Top 3 Farms
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="direction" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <PolarRadiusAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
            {top3Short.map((fname, idx) => (
              <Radar
                key={fname}
                name={fname}
                dataKey={fname}
                stroke={RADAR_COLOURS[idx]}
                fill={RADAR_COLOURS[idx]}
                fillOpacity={0.15}
              />
            ))}
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Scatter — Revenue Gain vs Implementation Cost */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-4">
          Optimisation: Revenue Gain vs Implementation Cost (bubble = Energy Gain GWh)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              dataKey="x"
              name="Implementation Cost ($M)"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Implementation Cost ($M)', fill: '#9ca3af', dy: 16, fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Revenue Gain ($M)"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Revenue Gain ($M)', fill: '#9ca3af', angle: -90, dx: -12, fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="z" range={[40, 400]} name="Energy Gain (GWh)" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Scatter name="Optimisation" data={scatterData} fill="#f59e0b" opacity={0.8} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Capacity Factor Trend */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-4">
          Capacity Factor % by Year — 5 Farms
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lineData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[20, 50]} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {line5Short.map((fname, idx) => (
              <Line
                key={fname}
                type="monotone"
                dataKey={fname}
                stroke={LINE_COLOURS[idx]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Energy Uplift by Technology */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-4">
          Energy Uplift % by Technology (colour = maturity)
        </h2>
        <div className="flex gap-4 mb-2">
          {Object.entries(MATURITY_COLOUR).map(([label, colour]) => (
            <span key={label} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded" style={{ background: colour }} />
              {label}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={techData} margin={{ top: 8, right: 16, bottom: 90, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none' }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(v: number, _: string, entry: { payload?: { maturity?: string } }) => [
                `${v} %`,
                `Uplift (${entry.payload?.maturity ?? ''})`,
              ]}
            />
            <Bar dataKey="uplift" name="Energy Uplift %">
              {techData.map((entry, index) => (
                <rect key={`bar-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
          <div>
            <dt className="text-xs text-gray-400">Total Installed Capacity (GW)</dt>
            <dd className="text-base font-semibold text-white">
              {(summary.total_installed_capacity_gw as number).toFixed(3)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Avg Wake Loss (%)</dt>
            <dd className="text-base font-semibold text-white">
              {(summary.avg_wake_loss_pct as number).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Max Energy Gain Potential (GWh)</dt>
            <dd className="text-base font-semibold text-white">
              {(summary.max_energy_gain_potential_gwh as number).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Best Optimisation</dt>
            <dd className="text-base font-semibold text-white">
              {summary.best_optimisation as string}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Avg Capacity Factor (%)</dt>
            <dd className="text-base font-semibold text-white">
              {(summary.avg_capacity_factor_pct as number).toFixed(2)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
