import { useState, useEffect } from 'react'
import { Waves } from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api, OWPDashboard, OWPLicenceRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPLICATION: 'bg-gray-600 text-gray-100',
    FEASIBILITY: 'bg-blue-700 text-blue-100',
    COMMERCIAL: 'bg-amber-600 text-amber-100',
    CONSTRUCTION: 'bg-orange-600 text-orange-100',
    OPERATING: 'bg-green-700 text-green-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[status] ?? 'bg-gray-700 text-gray-100'}`}>
      {status}
    </span>
  )
}

function TechBadge({ tech }: { tech: string }) {
  const cls =
    tech === 'FIXED_BOTTOM'
      ? 'bg-blue-800 text-blue-100'
      : 'bg-teal-700 text-teal-100'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {tech === 'FIXED_BOTTOM' ? 'Fixed Bottom' : 'Floating'}
    </span>
  )
}

function ConstraintBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    LOW: 'bg-green-700 text-green-100',
    MEDIUM: 'bg-amber-600 text-amber-100',
    HIGH: 'bg-orange-600 text-orange-100',
    CRITICAL: 'bg-red-700 text-red-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[level] ?? 'bg-gray-700 text-gray-100'}`}>
      {level}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string | number
  unit: string
  sub?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Capacity Outlook chart — dual-scenario
// ---------------------------------------------------------------------------

function CapacityOutlookChart({ data }: { data: OWPDashboard['capacity_outlook'] }) {
  // Merge STEP_CHANGE and CENTRAL by year
  const yearMap: Record<number, { year: number; step_change_gw?: number; central_gw?: number; step_additions?: number; central_additions?: number }> = {}
  data.forEach((d) => {
    if (!yearMap[d.year]) yearMap[d.year] = { year: d.year }
    if (d.scenario === 'STEP_CHANGE') {
      yearMap[d.year].step_change_gw = d.cumulative_capacity_gw
      yearMap[d.year].step_additions = d.annual_additions_gw
    } else {
      yearMap[d.year].central_gw = d.cumulative_capacity_gw
      yearMap[d.year].central_additions = d.annual_additions_gw
    }
  })
  const chartData = Object.values(yearMap).sort((a, b) => a.year - b.year)

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">
        Cumulative Capacity Outlook 2025–2040 (GW)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="stepGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="centralGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" GW" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="step_change_gw"
            name="Step Change"
            stroke="#3b82f6"
            fill="url(#stepGrad)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="central_gw"
            name="Central"
            stroke="#14b8a6"
            fill="url(#centralGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      <h3 className="text-sm font-semibold text-gray-200 mt-6 mb-3">
        Annual Capacity Additions (GW/yr)
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" GW" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Line type="monotone" dataKey="step_additions" name="Step Change Additions" stroke="#60a5fa" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="central_additions" name="Central Additions" stroke="#2dd4bf" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function OffshoreWindPipeline() {
  const [dashboard, setDashboard] = useState<OWPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Licence filter state
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterTech, setFilterTech] = useState<string>('ALL')

  useEffect(() => {
    api
      .getOWPDashboard()
      .then((d) => {
        setDashboard(d)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading Offshore Wind Pipeline data…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        Error: {error ?? 'No data returned'}
      </div>
    )
  }

  // Filtered licences
  const filteredLicences = dashboard.licence_records.filter((r: OWPLicenceRecord) => {
    const statusOk = filterStatus === 'ALL' || r.licence_status === filterStatus
    const techOk = filterTech === 'ALL' || r.turbine_technology === filterTech
    return statusOk && techOk
  })

  return (
    <div className="min-h-full bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Waves className="text-teal-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">
            Australian Offshore Wind Development Pipeline
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Declared offshore areas, licencing pipeline, developer activity, technology specs and capacity outlook
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Declared Potential"
          value={dashboard.total_declared_area_gw.toFixed(1)}
          unit="GW"
          sub="Across all declared offshore areas"
        />
        <KpiCard
          label="Licenced Pipeline"
          value={dashboard.total_licenced_pipeline_gw.toFixed(1)}
          unit="GW"
          sub="All stages (application to operating)"
        />
        <KpiCard
          label="Operating Capacity"
          value={dashboard.operating_capacity_mw.toFixed(0)}
          unit="MW"
          sub="Currently generating"
        />
        <KpiCard
          label="Jobs Supported 2030"
          value={dashboard.total_jobs_2030.toLocaleString()}
          unit="jobs"
          sub="Step Change scenario"
        />
      </div>

      {/* Capacity Outlook Chart */}
      <CapacityOutlookChart data={dashboard.capacity_outlook} />

      {/* Declared Areas Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">
          Declared Offshore Areas
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 pr-3 font-medium">Area Name</th>
                <th className="pb-2 pr-3 font-medium">State</th>
                <th className="pb-2 pr-3 font-medium">Water Depth</th>
                <th className="pb-2 pr-3 font-medium">Area (km²)</th>
                <th className="pb-2 pr-3 font-medium">Resource (GW)</th>
                <th className="pb-2 pr-3 font-medium">Applications</th>
                <th className="pb-2 pr-3 font-medium">Approved</th>
                <th className="pb-2 pr-3 font-medium">Grid Connection</th>
                <th className="pb-2 font-medium">Shore (km)</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.declared_areas.map((area) => (
                <tr key={area.area_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-3 font-medium text-white">{area.area_name}</td>
                  <td className="py-2 pr-3 text-gray-300">{area.state}</td>
                  <td className="py-2 pr-3 text-gray-300">{area.water_depth_range_m}</td>
                  <td className="py-2 pr-3 text-gray-300">{area.area_km2.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-teal-400 font-semibold">{area.wind_resource_gw.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-gray-300">{area.licence_applications}</td>
                  <td className="py-2 pr-3 text-green-400">{area.approved_licences}</td>
                  <td className="py-2 pr-3 text-gray-300">{area.grid_connection_point}</td>
                  <td className="py-2 text-gray-300">{area.onshore_distance_km}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Licence Pipeline Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-200">
            Licence Pipeline
          </h3>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPLICATION">Application</option>
              <option value="FEASIBILITY">Feasibility</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="CONSTRUCTION">Construction</option>
              <option value="OPERATING">Operating</option>
            </select>
            <select
              value={filterTech}
              onChange={(e) => setFilterTech(e.target.value)}
              className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none"
            >
              <option value="ALL">All Technologies</option>
              <option value="FIXED_BOTTOM">Fixed Bottom</option>
              <option value="FLOATING">Floating</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 pr-3 font-medium">Project</th>
                <th className="pb-2 pr-3 font-medium">Developer</th>
                <th className="pb-2 pr-3 font-medium">Area</th>
                <th className="pb-2 pr-3 font-medium">Technology</th>
                <th className="pb-2 pr-3 font-medium">Capacity (MW)</th>
                <th className="pb-2 pr-3 font-medium">Turbine (MW)</th>
                <th className="pb-2 pr-3 font-medium">Distance (km)</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">First Power</th>
                <th className="pb-2 pr-3 font-medium">CAPEX ($B)</th>
                <th className="pb-2 font-medium">LCOE ($/MWh)</th>
              </tr>
            </thead>
            <tbody>
              {filteredLicences.map((lic) => (
                <tr key={lic.licence_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-3 font-medium text-white">{lic.project_name}</td>
                  <td className="py-2 pr-3 text-gray-300">{lic.developer}</td>
                  <td className="py-2 pr-3 text-gray-300">{lic.area_name}</td>
                  <td className="py-2 pr-3"><TechBadge tech={lic.turbine_technology} /></td>
                  <td className="py-2 pr-3 text-blue-300 font-semibold">{lic.capacity_mw.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-gray-300">{lic.turbine_mw}</td>
                  <td className="py-2 pr-3 text-gray-300">{lic.distance_shore_km}</td>
                  <td className="py-2 pr-3"><StatusBadge status={lic.licence_status} /></td>
                  <td className="py-2 pr-3 text-gray-300">{lic.first_power_year ?? '—'}</td>
                  <td className="py-2 pr-3 text-amber-400">${lic.capex_b_aud.toFixed(1)}B</td>
                  <td className="py-2 text-teal-300">${lic.lcoe_mwh.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLicences.length === 0 && (
            <p className="text-center text-gray-500 py-4 text-xs">No records match selected filters.</p>
          )}
        </div>
      </div>

      {/* Supply Chain Constraints */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">
          Supply Chain Constraints
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 pr-3 font-medium">Component</th>
                <th className="pb-2 pr-3 font-medium">AU Content %</th>
                <th className="pb-2 pr-3 font-medium">Constraint</th>
                <th className="pb-2 pr-3 font-medium">Lead Time (mo)</th>
                <th className="pb-2 pr-3 font-medium">Key Suppliers</th>
                <th className="pb-2 font-medium">Port Requirements</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.supply_chain.map((sc, i) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-3 font-medium text-white">{sc.component.replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-3 text-gray-300">{sc.australian_content_pct.toFixed(0)}%</td>
                  <td className="py-2 pr-3"><ConstraintBadge level={sc.global_supply_constraint} /></td>
                  <td className="py-2 pr-3 text-gray-300">{sc.lead_time_months}</td>
                  <td className="py-2 pr-3 text-gray-400 max-w-xs truncate" title={sc.key_suppliers.join(', ')}>
                    {sc.key_suppliers.join(', ')}
                  </td>
                  <td className="py-2 text-gray-400 max-w-xs truncate" title={sc.port_requirements}>
                    {sc.port_requirements}
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
