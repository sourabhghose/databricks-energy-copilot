import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis,
} from 'recharts'
import { Waves } from 'lucide-react'
import {
  getWaveTidalOceanDashboard,
  WTOEDashboard,
  WTOEProjectRecord,
  WTOETechnologyRecord,
  WTOEMarketRecord,
  WTOEResourceRecord,
} from '../api/client'

// ── colour palette ─────────────────────────────────────────────────────────────
const COLOURS = {
  wave:    '#34d399',
  tidal:   '#60a5fa',
  otec:    '#f59e0b',
  hybrid:  '#a78bfa',
  barrage: '#f472b6',
  current: '#34d399',
  optim:   '#60a5fa',
  pessim:  '#f87171',
  cis:     '#f59e0b',
  coloc:   '#a78bfa',
  c2024:   '#f59e0b',
  c2030:   '#34d399',
  c2040:   '#60a5fa',
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── stage badge ───────────────────────────────────────────────────────────────
const STAGE_COLOURS: Record<string, string> = {
  Research:           'bg-gray-700 text-gray-300',
  Pilot:              'bg-blue-900 text-blue-300',
  Demonstration:      'bg-amber-900 text-amber-300',
  'Commercial Scale': 'bg-green-900 text-green-300',
  Planned:            'bg-purple-900 text-purple-300',
}

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STAGE_COLOURS[stage] ?? 'bg-gray-700 text-gray-300'}`}>
      {stage}
    </span>
  )
}

// ── main component ─────────────────────────────────────────────────────────────
export default function WaveTidalOceanAnalytics() {
  const [data, setData]       = useState<WTOEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getWaveTidalOceanDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 bg-gray-900">
      <p className="text-gray-400 animate-pulse text-lg">Loading Wave & Tidal Ocean Energy data…</p>
    </div>
  )
  if (error || !data) return (
    <div className="flex items-center justify-center h-64 bg-gray-900">
      <p className="text-red-400">Error: {error ?? 'No data returned'}</p>
    </div>
  )

  const { projects, resources, technologies, economics, global_market, summary } = data

  // ── stage breakdown by technology ─────────────────────────────────────────
  const stageTechMap: Record<string, Record<string, number>> = {}
  projects.forEach((p: WTOEProjectRecord) => {
    if (!stageTechMap[p.stage]) stageTechMap[p.stage] = {}
    stageTechMap[p.stage][p.technology] = (stageTechMap[p.stage][p.technology] ?? 0) + 1
  })
  const stageChartData = Object.entries(stageTechMap).map(([stage, techs]) => ({
    stage,
    ...techs,
  }))
  const uniqueTechs = [...new Set(projects.map((p: WTOEProjectRecord) => p.technology))]
  const techColourMap: Record<string, string> = {
    'Wave Energy Converter': COLOURS.wave,
    'Tidal Stream':          COLOURS.tidal,
    'Tidal Barrage':         COLOURS.barrage,
    'OTEC':                  COLOURS.otec,
    'Hybrid':                COLOURS.hybrid,
    'Salinity Gradient':     '#e879f9',
  }

  // ── technology LCOE learning curves 2024-2040 ─────────────────────────────
  const lcoeChartData = [
    { year: '2024', ...Object.fromEntries(technologies.map((t: WTOETechnologyRecord) => [t.technology_name.slice(0, 20), t.lcoe_2024_dolpermwh])) },
    { year: '2030', ...Object.fromEntries(technologies.map((t: WTOETechnologyRecord) => [t.technology_name.slice(0, 20), t.lcoe_2030_dolpermwh])) },
    { year: '2040', ...Object.fromEntries(technologies.map((t: WTOETechnologyRecord) => [t.technology_name.slice(0, 20), t.lcoe_2040_dolpermwh])) },
  ]
  const techLineColours = ['#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa', '#e879f9', '#38bdf8', '#fb923c']

  // ── global market installed capacity ──────────────────────────────────────
  const globalChartData = global_market.map((m: WTOEMarketRecord) => ({
    country:   m.country,
    installed: m.installed_capacity_mw,
    pipeline:  m.pipeline_capacity_mw,
  }))

  // ── scatter: wave height vs tidal velocity ────────────────────────────────
  const scatterData = resources.map((r: WTOEResourceRecord) => ({
    x:    r.significant_wave_height_m,
    y:    r.tidal_velocity_m_s,
    z:    r.theoretical_capacity_gw * 10,
    name: r.site_name,
    type: r.resource_type,
  }))

  // ── summary values ────────────────────────────────────────────────────────
  const demoCapKw    = Number(summary.total_demonstration_capacity_kw ?? 0)
  const bestLcoe     = Number(summary.best_lcoe_current_dolpermwh ?? 0)
  const resourceGw   = Number(summary.total_australian_resource_gw ?? 0)
  const gridCount    = Number(summary.projects_grid_connected ?? 0)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-teal-900 rounded-xl">
          <Waves className="text-teal-400" size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Wave &amp; Tidal Ocean Energy Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Emerging marine energy — Australian coasts &amp; global benchmarks
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Demonstration Capacity"
          value={`${(demoCapKw / 1000).toFixed(1)} MW`}
          sub="Pilot + Demo + Commercial projects"
        />
        <KPICard
          label="Best Current LCOE"
          value={`$${bestLcoe.toFixed(0)}/MWh`}
          sub="Lowest project LCOE today"
        />
        <KPICard
          label="Australian Resource"
          value={`${resourceGw.toFixed(0)} GW`}
          sub="Theoretical capacity (assessed sites)"
        />
        <KPICard
          label="Grid-Connected Projects"
          value={String(gridCount)}
          sub="Projects with grid connection"
        />
      </div>

      {/* Row 1: Stage breakdown + LCOE learning curves */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Stage breakdown by technology */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wider">
            Project Stage by Technology
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stageChartData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="stage" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11, paddingTop: 8 }} />
              {uniqueTechs.map((tech) => (
                <Bar key={tech} dataKey={tech} stackId="a" fill={techColourMap[tech] ?? '#6b7280'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LCOE learning curves */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wider">
            Technology LCOE Learning Curves ($/MWh)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lcoeChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $" domain={[100, 600]} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} formatter={(v) => [`$${v}/MWh`]} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 10 }} />
              {technologies.map((t: WTOETechnologyRecord, i: number) => (
                <Line
                  key={t.tech_id}
                  type="monotone"
                  dataKey={t.technology_name.slice(0, 20)}
                  stroke={techLineColours[i % techLineColours.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Global market + Resource scatter */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Global market installed capacity */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wider">
            Global Market — Installed &amp; Pipeline Capacity (MW)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={globalChartData} margin={{ top: 4, right: 16, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="country" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="installed" name="Installed (MW)" fill={COLOURS.wave} />
              <Bar dataKey="pipeline" name="Pipeline (MW)"   fill={COLOURS.tidal} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scatter: wave height vs tidal velocity */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200 mb-1 uppercase tracking-wider">
            Resource Sites — Wave Height vs Tidal Velocity
          </h2>
          <p className="text-xs text-gray-500 mb-3">Bubble size = theoretical capacity (GW)</p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="x" name="Wave Height (m)" unit=" m" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Sig. Wave Height (m)', position: 'insideBottom', offset: -4, fill: '#6b7280', fontSize: 10 }} />
              <YAxis dataKey="y" name="Tidal Velocity (m/s)" unit=" m/s" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <ZAxis dataKey="z" range={[40, 400]} name="Capacity" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }}
                formatter={(val, name) => {
                  if (name === 'Capacity') return [`${(Number(val) / 10).toFixed(1)} GW`, 'Theoretical Cap']
                  return [val, name]
                }}
              />
              <Scatter name="Wave sites"  data={scatterData.filter(d => d.type === 'Wave')}  fill={COLOURS.wave}  opacity={0.85} />
              <Scatter name="Tidal sites" data={scatterData.filter(d => d.type === 'Tidal')} fill={COLOURS.tidal} opacity={0.85} />
              <Scatter name="Mixed sites" data={scatterData.filter(d => d.type === 'Mixed')} fill={COLOURS.hybrid} opacity={0.85} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project overview table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wider">
          Project Overview
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Project</th>
                <th className="pb-2 pr-4">Technology</th>
                <th className="pb-2 pr-4">Developer</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4">Capacity (kW)</th>
                <th className="pb-2 pr-4">LCOE ($/MWh)</th>
                <th className="pb-2 pr-4">Stage</th>
                <th className="pb-2 pr-4">Grid</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p: WTOEProjectRecord) => (
                <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 text-white font-medium">{p.project_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.technology}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.developer}</td>
                  <td className="py-2 pr-4 text-gray-400">{p.state}</td>
                  <td className="py-2 pr-4 text-teal-400 font-mono">{p.installed_capacity_kw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-amber-400 font-mono">${p.lcoe_dolpermwh}</td>
                  <td className="py-2 pr-4"><StageBadge stage={p.stage} /></td>
                  <td className="py-2 pr-4">
                    <span className={p.grid_connected ? 'text-green-400' : 'text-gray-500'}>
                      {p.grid_connected ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Technology comparison table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wider">
          Technology Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Technology</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">TRL</th>
                <th className="pb-2 pr-4">Efficiency (%)</th>
                <th className="pb-2 pr-4">LCOE 2024</th>
                <th className="pb-2 pr-4">LCOE 2030</th>
                <th className="pb-2 pr-4">LCOE 2040</th>
                <th className="pb-2 pr-4">Survivability</th>
                <th className="pb-2 pr-0">Key Challenge</th>
              </tr>
            </thead>
            <tbody>
              {technologies.map((t: WTOETechnologyRecord) => (
                <tr key={t.tech_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 text-white font-medium">{t.technology_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{t.wave_or_tidal}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${t.trl_level >= 7 ? 'bg-green-900 text-green-300' : t.trl_level >= 5 ? 'bg-amber-900 text-amber-300' : 'bg-red-900 text-red-300'}`}>
                      TRL {t.trl_level}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-teal-400 font-mono">{t.efficiency_pct}%</td>
                  <td className="py-2 pr-4 text-amber-400 font-mono">${t.lcoe_2024_dolpermwh}</td>
                  <td className="py-2 pr-4 text-blue-400 font-mono">${t.lcoe_2030_dolpermwh}</td>
                  <td className="py-2 pr-4 text-green-400 font-mono">${t.lcoe_2040_dolpermwh}</td>
                  <td className="py-2 pr-4 text-gray-300">{'★'.repeat(t.survivability_rating)}{'☆'.repeat(5 - t.survivability_rating)}</td>
                  <td className="py-2 pr-0 text-gray-400 text-xs max-w-xs">{t.key_challenge}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
