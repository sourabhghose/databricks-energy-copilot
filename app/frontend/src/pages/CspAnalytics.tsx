import { useState, useEffect } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Sun, Zap, Flame } from 'lucide-react'
import { getCspAnalyticsDashboard } from '../api/client'
import type {
  CspAnalyticsDashboard,
  CSPTechnologyRecord,
  CSPProjectRecord,
  CSPResourceRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPERATING:    'bg-green-900/60 text-green-300 border border-green-700',
    CONSTRUCTION: 'bg-blue-900/60 text-blue-300 border border-blue-700',
    APPROVED:     'bg-amber-900/60 text-amber-300 border border-amber-700',
    PROPOSED:     'bg-purple-900/60 text-purple-300 border border-purple-700',
    CANCELLED:    'bg-red-900/60 text-red-300 border border-red-700',
  }
  const label: Record<string, string> = {
    OPERATING: 'Operating', CONSTRUCTION: 'Construction',
    APPROVED: 'Approved', PROPOSED: 'Proposed', CANCELLED: 'Cancelled',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-800 text-gray-400'}`}>
      {label[status] ?? status}
    </span>
  )
}

function TechBadge({ tech }: { tech: string }) {
  const map: Record<string, string> = {
    SOLAR_TOWER:      'bg-orange-900/60 text-orange-300 border border-orange-700',
    PARABOLIC_TROUGH: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
    LINEAR_FRESNEL:   'bg-cyan-900/60 text-cyan-300 border border-cyan-700',
    DISH_STIRLING:    'bg-pink-900/60 text-pink-300 border border-pink-700',
  }
  const label: Record<string, string> = {
    SOLAR_TOWER: 'Solar Tower', PARABOLIC_TROUGH: 'Parabolic Trough',
    LINEAR_FRESNEL: 'Linear Fresnel', DISH_STIRLING: 'Dish Stirling',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[tech] ?? 'bg-gray-800 text-gray-400'}`}>
      {label[tech] ?? tech}
    </span>
  )
}

function DniClassBadge({ cls }: { cls: string }) {
  const map: Record<string, string> = {
    WORLD_CLASS: 'bg-amber-900/60 text-amber-300 border border-amber-700',
    EXCELLENT:   'bg-green-900/60 text-green-300 border border-green-700',
    GOOD:        'bg-blue-900/60 text-blue-300 border border-blue-700',
    MARGINAL:    'bg-gray-800 text-gray-400 border border-gray-700',
  }
  const label: Record<string, string> = {
    WORLD_CLASS: 'World Class', EXCELLENT: 'Excellent', GOOD: 'Good', MARGINAL: 'Marginal',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[cls] ?? 'bg-gray-800 text-gray-400'}`}>
      {label[cls] ?? cls}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label, value, sub, icon: Icon, colour,
}: {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${colour}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Radar chart normaliser — converts raw tech record to radar axes
// ---------------------------------------------------------------------------

function toRadarData(techs: CSPTechnologyRecord[]) {
  const axes = [
    { label: 'Efficiency', key: 'peak_efficiency_pct', max: 30 },
    { label: 'Capacity Factor', key: 'annual_capacity_factor_pct', max: 50 },
    { label: 'Storage Hours', key: 'storage_hours', max: 12 },
    { label: 'LCOE (inv)', key: 'lcoe_inv', max: 100 },
    { label: 'Dispatchability', key: 'dispatchability_score', max: 10 },
  ]
  return axes.map((ax) =>
    Object.fromEntries([
      ['axis', ax.label],
      ...techs.map((t) => {
        const raw = ax.key === 'lcoe_inv'
          ? 300 - t.lcoe_aud_mwh   // invert so lower LCOE = higher score
          : (t as unknown as Record<string, number>)[ax.key]
        return [t.name.replace('_', ' '), Math.min(100, Math.round((raw / ax.max) * 100))]
      }),
    ])
  )
}

const TECH_COLOURS: Record<string, string> = {
  PARABOLIC_TROUGH: '#f59e0b',
  SOLAR_TOWER:      '#f97316',
  LINEAR_FRESNEL:   '#06b6d4',
  DISH_STIRLING:    '#ec4899',
}

const TECH_STROKE: Record<string, string> = {
  'PARABOLIC TROUGH': '#f59e0b',
  'SOLAR TOWER':      '#f97316',
  'LINEAR FRESNEL':   '#06b6d4',
  'DISH STIRLING':    '#ec4899',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CspAnalytics() {
  const [data, setData] = useState<CspAnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCspAnalyticsDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-400">Error loading CSP analytics: {error}</div>
    )
  }

  // KPI derivations
  const operatingProjects = data.projects.filter((p) => p.status === 'OPERATING')
  const totalCapacityMw = data.projects
    .filter((p) => ['OPERATING', 'CONSTRUCTION', 'APPROVED'].includes(p.status))
    .reduce((s, p) => s + p.capacity_mw, 0)
  const avgLcoe =
    data.projects.reduce((s, p) => s + p.expected_lcoe_aud_mwh, 0) / data.projects.length
  const worldClassSites = data.resources.filter((r) => r.dni_class === 'WORLD_CLASS').length
  const avgDispatch =
    data.technologies.reduce((s, t) => s + t.dispatchability_score, 0) /
    data.technologies.length

  // Radar data
  const radarData = toRadarData(data.technologies)

  // Dispatch area chart — aggregate all months
  const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const dispatchByMonth = monthOrder.map((m) => {
    const rows = data.dispatch_profiles.filter((d) => d.month === m)
    return {
      month: m,
      Solar: rows.reduce((s, r) => s + r.solar_mw, 0),
      Storage: rows.reduce((s, r) => s + r.storage_mw, 0),
    }
  })

  // LCOE bar chart
  const lcoeData = data.technologies.map((t) => ({
    name: t.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    LCOE: t.lcoe_aud_mwh,
    fill: TECH_COLOURS[t.name] ?? '#6b7280',
  }))

  return (
    <div className="p-6 space-y-6 text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-500/20 rounded-lg">
          <Sun size={24} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">CSP &amp; Solar Thermal Technology Analytics</h1>
          <p className="text-sm text-gray-400">
            Concentrating solar power — project pipeline, DNI resources, technology comparison &amp; dispatchability
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active CSP Pipeline"
          value={`${totalCapacityMw.toFixed(0)} MW`}
          sub="Operating + Construction + Approved"
          icon={Sun}
          colour="bg-orange-500/30"
        />
        <KpiCard
          label="Avg Portfolio LCOE"
          value={`$${avgLcoe.toFixed(0)}/MWh`}
          sub="Across all project records"
          icon={Flame}
          colour="bg-red-500/30"
        />
        <KpiCard
          label="World-Class DNI Sites"
          value={`${worldClassSites}`}
          sub={`of ${data.resources.length} resource areas`}
          icon={Zap}
          colour="bg-amber-500/30"
        />
        <KpiCard
          label="Avg Dispatchability Score"
          value={`${avgDispatch.toFixed(1)} / 10`}
          sub={`${operatingProjects.length} projects operating`}
          icon={Sun}
          colour="bg-yellow-500/30"
        />
      </div>

      {/* Row 1 — Radar + LCOE bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Technology Radar */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Technology Comparison Radar</h2>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              {data.technologies.map((t) => {
                const displayName = t.name.replace(/_/g, ' ')
                return (
                  <Radar
                    key={t.tech_id}
                    name={displayName}
                    dataKey={displayName}
                    stroke={TECH_STROKE[displayName] ?? '#6b7280'}
                    fill={TECH_STROKE[displayName] ?? '#6b7280'}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                )
              })}
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* LCOE Bar Chart */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">LCOE by Technology (AUD/MWh)</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={lcoeData} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: number) => [`$${v}/MWh`, 'LCOE']}
              />
              <Bar dataKey="LCOE" radius={[4, 4, 0, 0]}>
                {lcoeData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Dispatch Area Chart */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Monthly Dispatch Profile — Solar vs Thermal Storage Contribution (MW)
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dispatchByMonth} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <defs>
              <linearGradient id="gradSolar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradStorage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)} MW`, name]}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
            <Area type="monotone" dataKey="Solar" stroke="#f97316" fill="url(#gradSolar)" strokeWidth={2} />
            <Area type="monotone" dataKey="Storage" stroke="#06b6d4" fill="url(#gradStorage)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Project Pipeline Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">CSP Project Pipeline</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4 font-medium">Project</th>
                <th className="pb-2 pr-4 font-medium">Developer</th>
                <th className="pb-2 pr-4 font-medium">Region</th>
                <th className="pb-2 pr-4 font-medium">Technology</th>
                <th className="pb-2 pr-4 font-medium text-right">Capacity (MW)</th>
                <th className="pb-2 pr-4 font-medium text-right">Storage (h)</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">LCOE ($/MWh)</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p: CSPProjectRecord) => (
                <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-medium text-white max-w-[180px] truncate">{p.project_name}</td>
                  <td className="py-2 pr-4 text-gray-300 max-w-[140px] truncate">{p.developer}</td>
                  <td className="py-2 pr-4 text-gray-400">{p.region}</td>
                  <td className="py-2 pr-4"><TechBadge tech={p.technology} /></td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.capacity_mw.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.storage_hours}</td>
                  <td className="py-2 pr-4"><StatusBadge status={p.status} /></td>
                  <td className="py-2 text-right text-gray-300">${p.expected_lcoe_aud_mwh.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DNI Resource Quality Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">DNI Solar Resource Quality by Region</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4 font-medium">Location</th>
                <th className="pb-2 pr-4 font-medium">State</th>
                <th className="pb-2 pr-4 font-medium">DNI Class</th>
                <th className="pb-2 pr-4 font-medium text-right">Annual DNI (kWh/m²/yr)</th>
                <th className="pb-2 pr-4 font-medium text-right">Area (km²)</th>
                <th className="pb-2 pr-4 font-medium text-right">Grid Distance (km)</th>
                <th className="pb-2 font-medium text-center">Near Existing Project</th>
              </tr>
            </thead>
            <tbody>
              {data.resources.map((r: CSPResourceRecord) => (
                <tr key={r.location} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-medium text-white">{r.location}</td>
                  <td className="py-2 pr-4 text-gray-300">{r.state}</td>
                  <td className="py-2 pr-4"><DniClassBadge cls={r.dni_class} /></td>
                  <td className="py-2 pr-4 text-right text-amber-300 font-medium">{r.dni_kwh_m2_yr.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{r.area_km2.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{r.grid_distance_km.toFixed(0)}</td>
                  <td className="py-2 text-center">
                    {r.proximity_to_existing_project
                      ? <span className="text-green-400 text-xs font-medium">Yes</span>
                      : <span className="text-gray-500 text-xs">No</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Technology Details */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Technology Specifications</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.technologies.map((t: CSPTechnologyRecord) => (
            <div key={t.tech_id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <div className="mb-2">
                <TechBadge tech={t.name} />
              </div>
              <div className="space-y-1 mt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Peak Efficiency</span>
                  <span className="text-white font-medium">{t.peak_efficiency_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Capacity Factor</span>
                  <span className="text-white font-medium">{t.annual_capacity_factor_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Storage Hours</span>
                  <span className="text-white font-medium">{t.storage_hours}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">CAPEX (M AUD/MW)</span>
                  <span className="text-white font-medium">${t.capex_m_aud_mw}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">LCOE (AUD/MWh)</span>
                  <span className="text-amber-300 font-medium">${t.lcoe_aud_mwh}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Water Use (L/MWh)</span>
                  <span className="text-white font-medium">{t.water_use_l_mwh.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Land Use (ha/MW)</span>
                  <span className="text-white font-medium">{t.land_use_ha_mw}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">TRL</span>
                  <span className="text-white font-medium">{t.trl}/9</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dispatchability</span>
                  <span className="text-green-300 font-medium">{t.dispatchability_score}/10</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
