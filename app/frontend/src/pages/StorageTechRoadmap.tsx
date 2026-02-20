// ============================================================
// Sprint 55c — Energy Storage Technology Roadmap
// Emerging storage technologies, cost trajectory forecasts,
// and deployment milestones in the Australian context
// ============================================================

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { GitBranch, AlertTriangle, CheckCircle, Clock, XCircle, TrendingDown } from 'lucide-react'
import { getStorageTechRoadmapDashboard, StorageTechRoadmapDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  'Li-Ion LFP':           '#10b981',
  'Li-Ion NMC':           '#3b82f6',
  'Flow Vanadium Redox':  '#f59e0b',
  'Na-Ion Battery':       '#a78bfa',
  'Solid-State Battery':  '#f97316',
  'Flow Zinc-Bromine':    '#06b6d4',
  'Compressed Air (CAES)':'#84cc16',
  'Gravity Storage':      '#e879f9',
  'Liquid Air (LAES)':    '#fb7185',
  'Green Hydrogen Storage':'#38bdf8',
}

const MATURITY_CFG: Record<string, { bg: string; text: string; border: string }> = {
  COMMERCIAL: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
  PILOT:      { bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/40'    },
  DEMO:       { bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/40'   },
  RESEARCH:   { bg: 'bg-purple-500/20',  text: 'text-purple-400',  border: 'border-purple-500/40'  },
}

const STATUS_CFG: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  ACHIEVED:    { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', icon: <CheckCircle className="w-3 h-3" /> },
  ON_TRACK:    { bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/40',    icon: <Clock className="w-3 h-3" />       },
  AT_RISK:     { bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/40',   icon: <AlertTriangle className="w-3 h-3" /> },
  NOT_STARTED: { bg: 'bg-gray-500/20',    text: 'text-gray-400',    border: 'border-gray-500/40',    icon: <XCircle className="w-3 h-3" />     },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtLcos(v: number): string {
  return `$${v.toFixed(0)}/MWh`
}

function fmtGwh(v: number): string {
  if (v >= 1) return `${v.toFixed(1)} GWh`
  return `${(v * 1000).toFixed(0)} MWh`
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ title, value, subtitle, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">{title}</span>
        <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Technology Matrix Table
// ---------------------------------------------------------------------------

function TechnologyMatrixTable({ data }: { data: StorageTechRoadmapDashboard['technologies'] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">Storage Technology Matrix — All Technologies</h3>
      <p className="text-gray-500 text-xs mb-4">
        Maturity stage, duration, LCOS benchmarks, cycle life and Australian installed capacity
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 font-medium py-2 pr-3">Technology</th>
              <th className="text-center text-gray-400 font-medium py-2 pr-3">Maturity</th>
              <th className="text-center text-gray-400 font-medium py-2 pr-3">Duration (hr)</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-3">LCOS 2024</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-3">Target 2030</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-3">Cycle Life (k)</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-3">Cal. Life (yr)</th>
              <th className="text-right text-gray-400 font-medium py-2">AU Installed</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const matCfg = MATURITY_CFG[row.maturity] ?? MATURITY_CFG.RESEARCH
              const costRedn = ((row.current_lcos_aud_mwh - row.target_lcos_2030_aud_mwh) / row.current_lcos_aud_mwh * 100).toFixed(0)
              return (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: TECH_COLORS[row.name] ?? '#6b7280' }}
                      />
                      <span className="text-white font-medium text-xs">{row.name}</span>
                    </div>
                  </td>
                  <td className="text-center pr-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${matCfg.bg} ${matCfg.text} ${matCfg.border}`}>
                      {row.maturity}
                    </span>
                  </td>
                  <td className="text-gray-300 text-center pr-3 text-xs">{row.duration_range_hr}</td>
                  <td className="text-white font-semibold text-right pr-3">${row.current_lcos_aud_mwh.toFixed(0)}</td>
                  <td className="text-right pr-3">
                    <span className="text-emerald-400 font-semibold">${row.target_lcos_2030_aud_mwh.toFixed(0)}</span>
                    <span className="text-gray-500 text-xs ml-1">(-{costRedn}%)</span>
                  </td>
                  <td className="text-gray-300 text-right pr-3">{row.cycle_life_k_cycles.toFixed(0)}k</td>
                  <td className="text-gray-300 text-right pr-3">{row.calendar_life_years.toFixed(0)}</td>
                  <td className="text-right">
                    {row.australia_installed_mwh > 0
                      ? <span className="text-blue-400 font-semibold">{fmtGwh(row.australia_installed_mwh / 1000)}</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LCOS Cost Trajectory Chart — Top 5 technologies
// ---------------------------------------------------------------------------

function LcosTrajectorChart({ data }: { data: StorageTechRoadmapDashboard['cost_trajectories'] }) {
  const TOP5 = ['Li-Ion LFP', 'Li-Ion NMC', 'Flow Vanadium Redox', 'Na-Ion Battery', 'Compressed Air (CAES)']

  // pivot: year → { year, ...techValues }
  const years = [2024, 2025, 2026, 2027, 2028]
  const chartData = years.map(yr => {
    const row: Record<string, number | string> = { year: yr.toString() }
    TOP5.forEach(tech => {
      const rec = data.find(d => d.technology === tech && d.year === yr)
      if (rec) row[tech] = rec.lcos_aud_mwh
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">LCOS Cost Trajectory — Top 5 Technologies</h3>
      <p className="text-gray-500 text-xs mb-4">
        Levelised Cost of Storage (AUD/MWh) forecast 2024–2028 converging toward grid competitiveness
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            domain={[80, 310]}
            unit=" $"
            width={60}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v: number, name: string) => [`$${v.toFixed(0)}/MWh`, name]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {TOP5.map(tech => (
            <Line
              key={tech}
              type="monotone"
              dataKey={tech}
              stroke={TECH_COLORS[tech] ?? '#6b7280'}
              strokeWidth={2}
              dot={{ r: 4, fill: TECH_COLORS[tech] ?? '#6b7280' }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Deployment Forecast Stacked Area Chart
// ---------------------------------------------------------------------------

function DeploymentForecastChart({ data }: { data: StorageTechRoadmapDashboard['market_forecasts'] }) {
  const TECHS = ['Li-Ion LFP', 'Li-Ion NMC', 'Flow Vanadium Redox', 'Na-Ion Battery', 'Solid-State Battery', 'Green Hydrogen Storage']
  const years = [2024, 2025, 2026, 2027, 2028]

  const chartData = years.map(yr => {
    const row: Record<string, number | string> = { year: yr.toString() }
    TECHS.forEach(tech => {
      const rec = data.find(d => d.technology === tech && d.year === yr)
      row[tech] = rec ? parseFloat(rec.cumulative_deployed_gwh.toFixed(3)) : 0
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">Cumulative Deployment Forecast — Australian Market</h3>
      <p className="text-gray-500 text-xs mb-4">
        Stacked cumulative GWh by storage technology in the NEM/WEM 2024–2028
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            {TECHS.map(tech => (
              <linearGradient key={tech} id={`grad_${tech.replace(/[^a-zA-Z]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TECH_COLORS[tech] ?? '#6b7280'} stopOpacity={0.5} />
                <stop offset="95%" stopColor={TECH_COLORS[tech] ?? '#6b7280'} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GWh" width={65} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v: number, name: string) => [`${v.toFixed(2)} GWh`, name]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {TECHS.map(tech => (
            <Area
              key={tech}
              type="monotone"
              dataKey={tech}
              stackId="1"
              stroke={TECH_COLORS[tech] ?? '#6b7280'}
              fill={`url(#grad_${tech.replace(/[^a-zA-Z]/g, '')})`}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Milestone Tracker Table
// ---------------------------------------------------------------------------

function MilestoneTrackerTable({ data }: { data: StorageTechRoadmapDashboard['milestones'] }) {
  const sorted = [...data].sort((a, b) => a.target_year - b.target_year)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">Deployment Milestone Tracker</h3>
      <p className="text-gray-500 text-xs mb-4">
        Key Australian energy storage milestones — status, responsible organisations and target capacity
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 font-medium py-2 pr-3">Technology</th>
              <th className="text-left text-gray-400 font-medium py-2 pr-3">Milestone</th>
              <th className="text-center text-gray-400 font-medium py-2 pr-3">Year</th>
              <th className="text-center text-gray-400 font-medium py-2 pr-3">Status</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-3">Capacity</th>
              <th className="text-left text-gray-400 font-medium py-2">Organisation</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const stCfg = STATUS_CFG[row.status] ?? STATUS_CFG.NOT_STARTED
              return (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: TECH_COLORS[row.technology] ?? '#6b7280' }}
                      />
                      <span className="text-gray-300 text-xs font-medium">{row.technology}</span>
                    </div>
                  </td>
                  <td className="text-white text-xs pr-3 max-w-xs">{row.milestone}</td>
                  <td className="text-center pr-3">
                    <span className="text-gray-300 font-mono text-xs">{row.target_year}</span>
                  </td>
                  <td className="text-center pr-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${stCfg.bg} ${stCfg.text} ${stCfg.border}`}>
                      {stCfg.icon}
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-right pr-3">
                    {row.capacity_mwh > 0
                      ? <span className="text-blue-400 font-semibold text-xs">{fmtGwh(row.capacity_mwh / 1000)}</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="text-gray-400 text-xs">{row.responsible_org}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Technology Scatter Plot — Energy Density vs Cycle Life
// ---------------------------------------------------------------------------

function TechScatterPlot({ data }: { data: StorageTechRoadmapDashboard['technologies'] }) {
  // Build scatter data — x: cycle_life_k_cycles, y: energy_density_kwh_m3, z: australia_installed_mwh
  const scatterData = data.map(d => ({
    name: d.name,
    x: d.cycle_life_k_cycles,
    y: d.energy_density_kwh_m3,
    z: Math.max(d.australia_installed_mwh, 20), // min bubble size
    installed: d.australia_installed_mwh,
    color: TECH_COLORS[d.name] ?? '#6b7280',
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">Energy Density vs Cycle Life — Technology Landscape</h3>
      <p className="text-gray-500 text-xs mb-4">
        Bubble size = Australian installed MWh. X: cycle life (thousand cycles), Y: energy density (kWh/m³)
      </p>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            dataKey="x"
            name="Cycle Life"
            unit="k"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Cycle Life (k cycles)', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Energy Density"
            unit=" kWh/m³"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={70}
          />
          <ZAxis type="number" dataKey="z" range={[60, 1400]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: '#4b5563' }}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            content={({ payload }) => {
              if (!payload?.length) return null
              const d = payload[0].payload
              return (
                <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-xs">
                  <p className="text-white font-semibold mb-1">{d.name}</p>
                  <p className="text-gray-400">Cycle Life: <span className="text-white">{d.x}k cycles</span></p>
                  <p className="text-gray-400">Energy Density: <span className="text-white">{d.y} kWh/m³</span></p>
                  <p className="text-gray-400">AU Installed: <span className="text-blue-400">{fmtGwh(d.installed / 1000)}</span></p>
                </div>
              )
            }}
          />
          <Scatter data={scatterData} shape="circle">
            {scatterData.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.75} stroke={entry.color} strokeWidth={1.5} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TECH_COLORS[d.name] ?? '#6b7280' }} />
            {d.name}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cost Reduction Bar Chart — % reduction by tech 2024→2028
// ---------------------------------------------------------------------------

function CostReductionChart({ data }: { data: StorageTechRoadmapDashboard['cost_trajectories'] }) {
  const techs = Array.from(new Set(data.map(d => d.technology)))
  const chartData = techs.map(tech => {
    const r2024 = data.find(d => d.technology === tech && d.year === 2024)
    const r2028 = data.find(d => d.technology === tech && d.year === 2028)
    const reduction = r2024 && r2028
      ? ((r2024.lcos_aud_mwh - r2028.lcos_aud_mwh) / r2024.lcos_aud_mwh * 100)
      : 0
    return {
      tech: tech.replace(' Battery', '').replace(' Storage', '').replace('Compressed Air ', 'CAES ').replace('Liquid Air ', 'LAES '),
      reduction: parseFloat(reduction.toFixed(1)),
      color: TECH_COLORS[tech] ?? '#6b7280',
    }
  }).sort((a, b) => b.reduction - a.reduction)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">LCOS Cost Reduction 2024→2028 by Technology</h3>
      <p className="text-gray-500 text-xs mb-4">
        Percentage reduction in Levelised Cost of Storage from 2024 baseline to 2028 forecast
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 50]} />
          <YAxis type="category" dataKey="tech" tick={{ fill: '#9ca3af', fontSize: 10 }} width={80} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v: number) => [`${v.toFixed(1)}% reduction`, 'LCOS Change']}
          />
          <Bar dataKey="reduction" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function StorageTechRoadmap() {
  const [data, setData] = useState<StorageTechRoadmapDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStorageTechRoadmapDashboard()
      .then(setData)
      .catch((err) => setError(err.message ?? 'Failed to load Storage Technology Roadmap'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
        Loading Storage Technology Roadmap...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="w-6 h-6 mr-2" />
        {error ?? 'No data available'}
      </div>
    )
  }

  // KPI computations
  const commercialCount = data.technologies.filter(t => t.maturity === 'COMMERCIAL').length
  const cheapest2030 = Math.min(...data.technologies.map(t => t.target_lcos_2030_aud_mwh))
  const cheapest2030Tech = data.technologies.find(t => t.target_lcos_2030_aud_mwh === cheapest2030)
  const totalAuInstalled = data.technologies.reduce((s, t) => s + t.australia_installed_mwh, 0)
  const onTrackCount = data.milestones.filter(m => m.status === 'ON_TRACK' || m.status === 'ACHIEVED').length

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-500/30">
          <GitBranch className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Energy Storage Technology Roadmap</h1>
          <p className="text-gray-400 text-sm">
            Emerging storage technologies, cost trajectories and deployment milestones — Australian context
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <TrendingDown className="w-4 h-4 text-emerald-500" />
          <span>Forecast: 2024–2028</span>
          <span className="mx-1">|</span>
          <GitBranch className="w-4 h-4 text-blue-400" />
          <span>10 Technologies</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Commercial-Stage Technologies"
          value={`${commercialCount} of ${data.technologies.length}`}
          subtitle="Technologies at commercial deployment maturity in 2024"
          icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
          accent="bg-emerald-500/15"
        />
        <KpiCard
          title="Cheapest 2030 LCOS Target"
          value={fmtLcos(cheapest2030)}
          subtitle={`${cheapest2030Tech?.name ?? '—'} — most cost-competitive by 2030`}
          icon={<TrendingDown className="w-5 h-5 text-blue-400" />}
          accent="bg-blue-500/15"
        />
        <KpiCard
          title="Total AU Installed (2024)"
          value={fmtGwh(totalAuInstalled / 1000)}
          subtitle="Cumulative energy storage installed across NEM and WEM"
          icon={<GitBranch className="w-5 h-5 text-amber-400" />}
          accent="bg-amber-500/15"
        />
        <KpiCard
          title="Milestones On-Track / Achieved"
          value={`${onTrackCount} of ${data.milestones.length}`}
          subtitle="Australian storage deployment milestones progressing positively"
          icon={<Clock className="w-5 h-5 text-purple-400" />}
          accent="bg-purple-500/15"
        />
      </div>

      {/* Technology Matrix Table */}
      <TechnologyMatrixTable data={data.technologies} />

      {/* LCOS Cost Trajectory + Cost Reduction */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LcosTrajectorChart data={data.cost_trajectories} />
        <CostReductionChart data={data.cost_trajectories} />
      </div>

      {/* Deployment Forecast Stacked Area */}
      <DeploymentForecastChart data={data.market_forecasts} />

      {/* Milestone Tracker */}
      <MilestoneTrackerTable data={data.milestones} />

      {/* Technology Scatter Plot */}
      <TechScatterPlot data={data.technologies} />

      {/* Footer */}
      <div className="text-xs text-gray-600 text-center pt-2">
        Sprint 55c — Data: ARENA Storage Roadmap | AEMO ISP 2024 | BloombergNEF BNEF Storage Outlook | CSIRO GenCost 2024 | Hydrostor / Redflow / CellCube project data
      </div>
    </div>
  )
}
