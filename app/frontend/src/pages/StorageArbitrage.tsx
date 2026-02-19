import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
} from 'recharts'
import { Battery } from 'lucide-react'
import { api, StorageDashboard, BessProject, StorageDispatchRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kpiCard(label: string, value: string, sub?: string) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

const TECH_BADGE: Record<string, string> = {
  LI_ION:        'bg-blue-700 text-blue-100',
  FLOW:          'bg-cyan-700 text-cyan-100',
  COMPRESSED_AIR:'bg-orange-700 text-orange-100',
  THERMAL:       'bg-red-700 text-red-100',
}

const STATUS_BADGE: Record<string, string> = {
  OPERATING:    'bg-green-700 text-green-100',
  CONSTRUCTION: 'bg-yellow-700 text-yellow-100',
  APPROVED:     'bg-blue-800 text-blue-100',
  PROPOSED:     'bg-gray-700 text-gray-100',
}

function TechBadge({ tech }: { tech: string }) {
  const cls = TECH_BADGE[tech] ?? 'bg-gray-700 text-gray-100'
  const label = tech.replace(/_/g, ' ')
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? 'bg-gray-700 text-gray-100'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Revenue Stack Chart
// ---------------------------------------------------------------------------

function RevenueStackChart({ projects }: { projects: BessProject[] }) {
  const operating = projects
    .filter(p => p.status === 'OPERATING' && p.project_name !== 'Snowy Pumped Hydro 2.0')
    .map(p => ({
      name: p.project_name.replace(' Battery', '').replace(' BESS', '').replace(' Power Reserve', ''),
      energy: p.energy_arbitrage_revenue_m_aud,
      fcas: p.fcas_revenue_m_aud,
      capacity: p.capacity_revenue_m_aud,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Annual Revenue Stack by Project ($M AUD)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={operating} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => [`$${v.toFixed(1)}M`, undefined]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar dataKey="energy"   name="Energy Arbitrage" stackId="a" fill="#3b82f6" />
          <Bar dataKey="fcas"     name="FCAS Revenue"     stackId="a" fill="#22c55e" />
          <Bar dataKey="capacity" name="Capacity Revenue" stackId="a" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Projects Table
// ---------------------------------------------------------------------------

const STATUS_FILTERS = ['ALL', 'OPERATING', 'CONSTRUCTION', 'APPROVED', 'PROPOSED']
const STATE_FILTERS  = ['ALL', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']

function ProjectsTable({ projects }: { projects: BessProject[] }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [stateFilter, setStateFilter]   = useState('ALL')

  const filtered = projects.filter(p => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
    if (stateFilter  !== 'ALL' && p.state  !== stateFilter)  return false
    return true
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-300 mr-2">BESS Projects Registry</h2>
        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {/* State filter */}
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
        >
          {STATE_FILTERS.map(s => (
            <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Project</th>
              <th className="text-left py-2 pr-3">Owner</th>
              <th className="text-left py-2 pr-3">State</th>
              <th className="text-left py-2 pr-3">Technology</th>
              <th className="text-right py-2 pr-3">Cap (MWh)</th>
              <th className="text-right py-2 pr-3">Power (MW)</th>
              <th className="text-right py-2 pr-3">Dur (h)</th>
              <th className="text-left py-2 pr-3">Status</th>
              <th className="text-right py-2 pr-3">RTE %</th>
              <th className="text-right py-2 pr-3">LCOE $/MWh</th>
              <th className="text-right py-2">Rev $M</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const totalRev = p.energy_arbitrage_revenue_m_aud + p.fcas_revenue_m_aud + p.capacity_revenue_m_aud
              return (
                <tr key={p.project_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-1.5 pr-3 font-medium text-white">{p.project_name}</td>
                  <td className="py-1.5 pr-3">{p.owner}</td>
                  <td className="py-1.5 pr-3">{p.state}</td>
                  <td className="py-1.5 pr-3"><TechBadge tech={p.technology} /></td>
                  <td className="py-1.5 pr-3 text-right">{p.capacity_mwh.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right">{p.power_mw.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right">{p.duration_hours.toFixed(2)}</td>
                  <td className="py-1.5 pr-3"><StatusBadge status={p.status} /></td>
                  <td className="py-1.5 pr-3 text-right">{p.round_trip_efficiency_pct.toFixed(1)}</td>
                  <td className="py-1.5 pr-3 text-right">{p.lcoe_mwh.toFixed(1)}</td>
                  <td className="py-1.5 text-right">
                    {p.status === 'OPERATING' ? `$${totalRev.toFixed(1)}M` : '—'}
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
// Dispatch Chart
// ---------------------------------------------------------------------------

function DispatchChart({ records }: { records: StorageDispatchRecord[] }) {
  const data = records.map(r => ({
    time:  r.trading_interval.slice(11),  // HH:MM
    charge: r.charge_mw,
    soc:    r.soc_pct,
    price:  r.spot_price_aud_mwh,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-1">
        Intraday Dispatch Profile — Hornsdale Power Reserve (BESS001)
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Charge MW (blue=charging / red=discharging), SoC % (green line), Spot Price $/MWh (amber area)
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 4, right: 50, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            interval={3}
          />
          {/* Left axis: charge MW */}
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
          />
          {/* Right axis: SoC % and price */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            label={{ value: '% / $/MWh', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb', fontSize: 11 }}
            itemStyle={{ color: '#d1d5db', fontSize: 11 }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar
            yAxisId="left"
            dataKey="charge"
            name="Charge MW"
            fill="#3b82f6"
            // Negative values render automatically in a different shade; we use a single color for simplicity
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="soc"
            name="SoC %"
            stroke="#22c55e"
            dot={false}
            strokeWidth={2}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="price"
            name="Spot Price $/MWh"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.12}
            dot={false}
            strokeWidth={1.5}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function StorageArbitrage() {
  const [data,    setData]    = useState<StorageDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    api.getStorageDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading storage analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error loading data: {error ?? 'unknown error'}
      </div>
    )
  }

  const fmtMwh = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)} GWh` : `${v.toLocaleString()} MWh`

  return (
    <div className="flex flex-col gap-6 p-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Battery className="text-blue-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">
            Grid-Scale Energy Storage Arbitrage Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            BESS economics, round-trip efficiency, revenue stacking (energy + FCAS + capacity), dispatch optimisation
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCard(
          'Total BESS Capacity',
          fmtMwh(data.total_storage_capacity_mwh),
          'Operating projects only',
        )}
        {kpiCard(
          'Total Storage Power',
          `${data.total_storage_power_mw.toLocaleString()} MW`,
          'Nameplate MW (operating)',
        )}
        {kpiCard(
          'Operating Projects',
          String(data.operating_projects),
          'Grid-connected BESS',
        )}
        {kpiCard(
          'Avg Round-Trip Efficiency',
          `${data.avg_round_trip_efficiency_pct.toFixed(1)}%`,
          'Charge → discharge cycle',
        )}
      </div>

      {/* Revenue Stack Chart */}
      <RevenueStackChart projects={data.projects} />

      {/* Projects Table */}
      <ProjectsTable projects={data.projects} />

      {/* Dispatch Profile Chart */}
      <DispatchChart records={data.dispatch_records} />

      {/* Footer note */}
      <p className="text-xs text-gray-600 text-center">
        Data as at {data.timestamp} AEST — simulated representative data for demonstration purposes
      </p>
    </div>
  )
}
