import { useEffect, useState, useMemo } from 'react'
import { MapPin, Zap, TrendingUp, DollarSign, RefreshCw, AlertCircle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { api } from '../api/client'
import type {
  RezCapacityDashboard,
  RezZoneRecord,
  RezProjectRecord,
  RezNetworkAugRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function ZoneTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    WIND: 'bg-blue-900 text-blue-200 border-blue-700',
    SOLAR: 'bg-amber-900 text-amber-200 border-amber-700',
    HYBRID: 'bg-green-900 text-green-200 border-green-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles[type] ?? 'bg-gray-800 text-gray-300 border-gray-600'}`}>
      {type}
    </span>
  )
}

function IspPriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    STEP_CHANGE: 'bg-green-900 text-green-200 border-green-700',
    CENTRAL: 'bg-amber-900 text-amber-200 border-amber-700',
    SLOW_CHANGE: 'bg-gray-700 text-gray-300 border-gray-600',
  }
  const labels: Record<string, string> = {
    STEP_CHANGE: 'Step Change',
    CENTRAL: 'Central',
    SLOW_CHANGE: 'Slow Change',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles[priority] ?? 'bg-gray-800 text-gray-300 border-gray-600'}`}>
      {labels[priority] ?? priority}
    </span>
  )
}

function TechBadge({ tech }: { tech: string }) {
  const styles: Record<string, string> = {
    WIND: 'bg-blue-900 text-blue-200 border-blue-700',
    SOLAR_FARM: 'bg-amber-900 text-amber-200 border-amber-700',
    HYBRID: 'bg-green-900 text-green-200 border-green-700',
    STORAGE: 'bg-purple-900 text-purple-200 border-purple-700',
  }
  const labels: Record<string, string> = {
    SOLAR_FARM: 'Solar',
    WIND: 'Wind',
    HYBRID: 'Hybrid',
    STORAGE: 'Storage',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles[tech] ?? 'bg-gray-800 text-gray-300 border-gray-600'}`}>
      {labels[tech] ?? tech}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPERATING: 'bg-green-900 text-green-200 border-green-700',
    CONSTRUCTION: 'bg-blue-900 text-blue-200 border-blue-700',
    APPROVED: 'bg-amber-900 text-amber-200 border-amber-700',
    PROPOSED: 'bg-gray-700 text-gray-300 border-gray-600',
  }
  const labels: Record<string, string> = {
    OPERATING: 'Operating',
    CONSTRUCTION: 'Construction',
    APPROVED: 'Approved',
    PROPOSED: 'Proposed',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles[status] ?? 'bg-gray-800 text-gray-300 border-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function OfftakeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    MERCHANT: 'bg-gray-700 text-gray-300 border-gray-600',
    PPA_CORPORATE: 'bg-blue-900 text-blue-200 border-blue-700',
    PPA_RETAILER: 'bg-green-900 text-green-200 border-green-700',
    GOVERNMENT: 'bg-purple-900 text-purple-200 border-purple-700',
  }
  const labels: Record<string, string> = {
    MERCHANT: 'Merchant',
    PPA_CORPORATE: 'Corp PPA',
    PPA_RETAILER: 'Retail PPA',
    GOVERNMENT: 'Govt',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles[type] ?? 'bg-gray-800 text-gray-300 border-gray-600'}`}>
      {labels[type] ?? type}
    </span>
  )
}

function AugTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    NEW_LINE: 'bg-blue-900 text-blue-200 border-blue-700',
    UPGRADE: 'bg-green-900 text-green-200 border-green-700',
    SUBSTATION: 'bg-amber-900 text-amber-200 border-amber-700',
    TRANSFORMER: 'bg-purple-900 text-purple-200 border-purple-700',
    REACTIVE_SUPPORT: 'bg-gray-700 text-gray-300 border-gray-600',
  }
  const labels: Record<string, string> = {
    NEW_LINE: 'New Line',
    UPGRADE: 'Upgrade',
    SUBSTATION: 'Substation',
    TRANSFORMER: 'Transformer',
    REACTIVE_SUPPORT: 'Reactive',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles[type] ?? 'bg-gray-800 text-gray-300 border-gray-600'}`}>
      {labels[type] ?? type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub: string
  Icon: React.ElementType
  color: string
}

function KpiCard({ label, value, sub, Icon, color }: KpiProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recharts colours
// ---------------------------------------------------------------------------

const REZ_COLORS: Record<string, string> = {
  'New England NSW': '#6366f1',
  'Central-West Orana NSW': '#22d3ee',
  'Western Victoria': '#f59e0b',
  'South Australia REZ': '#10b981',
  'Queensland Central': '#f43f5e',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RezCapacityTracking() {
  const [data, setData] = useState<RezCapacityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters for projects table
  const [filterZone, setFilterZone] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const d = await api.getRezCapacityDashboard()
      setData(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load REZ capacity data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Horizontal stacked bar data — zones sorted by target MW desc
  const barData = useMemo(() => {
    if (!data) return []
    return [...data.rez_zones]
      .sort((a, b) => b.target_capacity_mw - a.target_capacity_mw)
      .map((z: RezZoneRecord) => ({
        name: z.rez_name.replace(' NSW', '').replace(' QLD', '').replace(' VIC', '').replace(' SA', '').replace(' TAS', ''),
        Connected: z.connected_capacity_mw,
        Construction: z.under_construction_mw,
        Approved: z.approved_mw,
        Proposed: z.proposed_mw,
        Target: z.target_capacity_mw,
      }))
  }, [data])

  // Build-out stacked area data — pivot by year for 5 REZs
  const areaData = useMemo(() => {
    if (!data) return []
    const years = [2024, 2025, 2026, 2027, 2028, 2029]
    return years.map(yr => {
      const row: Record<string, number | string> = { year: yr }
      data.build_out_records
        .filter(b => b.year === yr)
        .forEach(b => { row[b.rez_name] = b.cumulative_capacity_mw })
      return row
    })
  }, [data])

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!data) return []
    return data.rez_projects.filter((p: RezProjectRecord) => {
      const zoneOk = filterZone === 'ALL' || p.rez_id === filterZone
      const statusOk = filterStatus === 'ALL' || p.status === filterStatus
      return zoneOk && statusOk
    })
  }, [data, filterZone, filterStatus])

  // Zone options for filter
  const zoneOptions = useMemo(() => {
    if (!data) return []
    const seen = new Set<string>()
    return data.rez_zones.filter(z => {
      if (seen.has(z.rez_id)) return false
      seen.add(z.rez_id)
      return true
    })
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading REZ capacity data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        <AlertCircle className="mr-2" size={20} />
        {error ?? 'No data available'}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-full text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-800 rounded-lg">
            <MapPin size={22} className="text-green-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Renewable Energy Zone (REZ) Capacity Tracker
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              ISP REZ pipeline, network augmentation, project connections and generation capacity build-out 2024–2029
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-sm text-gray-300 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total REZ Target"
          value={`${data.total_target_capacity_gw.toFixed(1)} GW`}
          sub="Across all ISP REZ zones"
          Icon={MapPin}
          color="bg-green-700"
        />
        <KpiCard
          label="Connected Capacity"
          value={`${data.total_connected_gw.toFixed(1)} GW`}
          sub="Currently operating in REZs"
          Icon={Zap}
          color="bg-blue-700"
        />
        <KpiCard
          label="Total Pipeline"
          value={`${data.total_pipeline_gw.toFixed(1)} GW`}
          sub="Construction + approved + proposed"
          Icon={TrendingUp}
          color="bg-amber-700"
        />
        <KpiCard
          label="Network Augmentation Cost"
          value={`$${data.network_augmentation_cost_b_aud.toFixed(2)}B`}
          sub="TNSP capex across REZ network"
          Icon={DollarSign}
          color="bg-purple-700"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Horizontal stacked bar — REZ Capacity Progress */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">REZ Capacity Progress (MW)</h2>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 110, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}GW`} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={105} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6', fontWeight: 600 }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => `${v.toLocaleString()} MW`}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="Connected" stackId="a" fill="#22c55e" name="Connected" />
              <Bar dataKey="Construction" stackId="a" fill="#3b82f6" name="Construction" />
              <Bar dataKey="Approved" stackId="a" fill="#f59e0b" name="Approved" />
              <Bar dataKey="Proposed" stackId="a" fill="#6b7280" name="Proposed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stacked area — Build-out Forecast */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Build-out Forecast 2024–2029 (Cumulative MW)</h2>
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={areaData} margin={{ top: 4, right: 16, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(1)}GW`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6', fontWeight: 600 }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => `${v.toLocaleString()} MW`}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {Object.entries(REZ_COLORS).map(([rezName, color]) => (
                <Area
                  key={rezName}
                  type="monotone"
                  dataKey={rezName}
                  stackId="1"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.7}
                  name={rezName}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* REZ Zones Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">REZ Zone Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 text-left font-medium pr-3">REZ Name</th>
                <th className="pb-2 text-left font-medium pr-3">State</th>
                <th className="pb-2 text-left font-medium pr-3">Type</th>
                <th className="pb-2 text-left font-medium pr-3">ISP Priority</th>
                <th className="pb-2 text-right font-medium pr-3">Target MW</th>
                <th className="pb-2 text-right font-medium pr-3">Connected MW</th>
                <th className="pb-2 text-right font-medium pr-3">Pipeline MW</th>
                <th className="pb-2 text-right font-medium pr-3">Network Limit MW</th>
                <th className="pb-2 text-right font-medium pr-3">Aug. Required MW</th>
                <th className="pb-2 text-right font-medium">Aug. Cost $M</th>
              </tr>
            </thead>
            <tbody>
              {[...data.rez_zones]
                .sort((a, b) => b.target_capacity_mw - a.target_capacity_mw)
                .map((z: RezZoneRecord) => (
                  <tr key={z.rez_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                    <td className="py-2 pr-3 font-medium text-white">{z.rez_name}</td>
                    <td className="py-2 pr-3">{z.state}</td>
                    <td className="py-2 pr-3"><ZoneTypeBadge type={z.zone_type} /></td>
                    <td className="py-2 pr-3"><IspPriorityBadge priority={z.isp_priority} /></td>
                    <td className="py-2 pr-3 text-right font-mono">{z.target_capacity_mw.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-mono text-green-400">{z.connected_capacity_mw.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-mono text-amber-400">
                      {(z.under_construction_mw + z.approved_mw + z.proposed_mw).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{z.network_limit_mw.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right font-mono text-red-400">{z.augmentation_required_mw.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">${z.augmentation_cost_m_aud.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projects Table with filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-200">
            REZ Projects ({filteredProjects.length} of {data.rez_projects.length})
          </h2>
          <div className="flex gap-2">
            <select
              value={filterZone}
              onChange={e => setFilterZone(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
            >
              <option value="ALL">All Zones</option>
              {zoneOptions.map(z => (
                <option key={z.rez_id} value={z.rez_id}>{z.rez_name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPERATING">Operating</option>
              <option value="CONSTRUCTION">Construction</option>
              <option value="APPROVED">Approved</option>
              <option value="PROPOSED">Proposed</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 text-left font-medium pr-3">Project</th>
                <th className="pb-2 text-left font-medium pr-3">REZ</th>
                <th className="pb-2 text-left font-medium pr-3">Tech</th>
                <th className="pb-2 text-left font-medium pr-3">Developer</th>
                <th className="pb-2 text-left font-medium pr-3">State</th>
                <th className="pb-2 text-right font-medium pr-3">MW</th>
                <th className="pb-2 text-left font-medium pr-3">Status</th>
                <th className="pb-2 text-right font-medium pr-3">Connect Year</th>
                <th className="pb-2 text-center font-medium pr-3">PPA</th>
                <th className="pb-2 text-left font-medium">Offtake</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p: RezProjectRecord) => (
                <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                  <td className="py-2 pr-3 font-medium text-white">{p.project_name}</td>
                  <td className="py-2 pr-3 text-gray-400">{p.rez_name}</td>
                  <td className="py-2 pr-3"><TechBadge tech={p.technology} /></td>
                  <td className="py-2 pr-3">{p.developer}</td>
                  <td className="py-2 pr-3">{p.state}</td>
                  <td className="py-2 pr-3 text-right font-mono text-green-400">{p.capacity_mw.toLocaleString()}</td>
                  <td className="py-2 pr-3"><StatusBadge status={p.status} /></td>
                  <td className="py-2 pr-3 text-right font-mono">{p.connection_year ?? '—'}</td>
                  <td className="py-2 pr-3 text-center">
                    <span className={p.ppa_signed ? 'text-green-400' : 'text-gray-500'}>
                      {p.ppa_signed ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-2"><OfftakeBadge type={p.offtake_type} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Network Augmentations Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Network Augmentation Projects</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="pb-2 text-left font-medium pr-3">Project</th>
                <th className="pb-2 text-left font-medium pr-3">REZ</th>
                <th className="pb-2 text-left font-medium pr-3">TNSP</th>
                <th className="pb-2 text-left font-medium pr-3">Type</th>
                <th className="pb-2 text-right font-medium pr-3">Voltage kV</th>
                <th className="pb-2 text-right font-medium pr-3">Capacity Inc. MW</th>
                <th className="pb-2 text-right font-medium pr-3">CAPEX $M</th>
                <th className="pb-2 text-left font-medium pr-3">Status</th>
                <th className="pb-2 text-right font-medium">Completion</th>
              </tr>
            </thead>
            <tbody>
              {data.network_augmentations.map((a: RezNetworkAugRecord) => (
                <tr key={a.project_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                  <td className="py-2 pr-3 font-medium text-white">{a.project_name}</td>
                  <td className="py-2 pr-3 text-gray-400">{a.rez_id}</td>
                  <td className="py-2 pr-3">{a.tnsp}</td>
                  <td className="py-2 pr-3"><AugTypeBadge type={a.augmentation_type} /></td>
                  <td className="py-2 pr-3 text-right font-mono">{a.voltage_kv}</td>
                  <td className="py-2 pr-3 text-right font-mono text-green-400">{a.capacity_increase_mw.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right font-mono text-amber-400">${a.capex_m_aud.toLocaleString()}</td>
                  <td className="py-2 pr-3"><StatusBadge status={a.status} /></td>
                  <td className="py-2 text-right font-mono">{a.completion_year ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
