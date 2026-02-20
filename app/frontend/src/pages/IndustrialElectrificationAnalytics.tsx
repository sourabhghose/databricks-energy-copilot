import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getIndustrialElectrificationDashboard,
  IEPDashboard,
  IEPSectorRecord,
  IEPProjectRecord,
  IEPLoadShapeRecord,
  IEPBarrierRecord,
  IEPInvestmentRecord,
} from '../api/client'
import { Zap, TrendingUp, Activity, AlertTriangle, DollarSign } from 'lucide-react'

const SECTOR_COLOURS: Record<string, string> = {
  MINING:        '#f59e0b',
  STEEL:         '#6366f1',
  ALUMINIUM:     '#14b8a6',
  CEMENT:        '#8b5cf6',
  CHEMICALS:     '#06b6d4',
  FOOD_BEVERAGE: '#10b981',
  PAPER:         '#84cc16',
  GLASS:         '#f43f5e',
}

const SEVERITY_BADGE: Record<string, string> = {
  HIGH:   'bg-red-500/20 text-red-300 border border-red-500/40',
  MEDIUM: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  LOW:    'bg-green-500/20 text-green-300 border border-green-500/40',
}

const STATUS_BADGE: Record<string, string> = {
  OPERATING:    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  CONSTRUCTION: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  COMMITTED:    'bg-violet-500/20 text-violet-300 border border-violet-500/40',
  ANNOUNCED:    'bg-gray-500/20 text-gray-300 border border-gray-500/40',
}

function KpiCard({ label, value, sub, icon: Icon, colour }: {
  label: string; value: string; sub?: string; icon: React.ElementType; colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---- Sector Overview chart ----
function SectorOverviewChart({ sectors }: { sectors: IEPSectorRecord[] }) {
  const data = sectors.map(s => ({
    name: s.sector.replace('_', ' '),
    'Current %':    s.current_electric_pct,
    'Target 2030 %': s.target_electric_pct_2030,
    'Target 2050 %': s.target_electric_pct_2050,
  }))
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">Electrification Rate by Sector</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => `${v.toFixed(1)}%`}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 12 }} />
          <Bar dataKey="Current %"    fill="#6366f1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Target 2030 %" fill="#14b8a6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Target 2050 %" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---- Incremental demand chart ----
function IncrementalDemandChart({ sectors }: { sectors: IEPSectorRecord[] }) {
  const data = sectors.map(s => ({
    name: s.sector.replace('_', ' '),
    '2030 TWh': s.incremental_demand_twh_2030,
    '2050 TWh': s.incremental_demand_twh_2050,
  }))
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">Incremental Electricity Demand (TWh)</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TWh" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 12 }} />
          <Bar dataKey="2030 TWh" fill="#14b8a6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="2050 TWh" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---- Projects Table ----
function ProjectsTable({ projects }: { projects: IEPProjectRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">Electrification Projects</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-3 pr-4 font-medium">ID</th>
              <th className="pb-3 pr-4 font-medium">Company</th>
              <th className="pb-3 pr-4 font-medium">Sector</th>
              <th className="pb-3 pr-4 font-medium">Technology</th>
              <th className="pb-3 pr-4 font-medium">Region</th>
              <th className="pb-3 pr-4 font-medium text-right">Cap. (MW)</th>
              <th className="pb-3 pr-4 font-medium text-right">CAPEX ($M)</th>
              <th className="pb-3 pr-4 font-medium text-right">Abatement (kt/yr)</th>
              <th className="pb-3 pr-4 font-medium text-right">Year</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-3 pr-4 text-gray-400 font-mono text-xs">{p.project_id}</td>
                <td className="py-3 pr-4 text-white">{p.company}</td>
                <td className="py-3 pr-4">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                    {p.sector.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-300 text-xs">{p.technology.replace(/_/g, ' ')}</td>
                <td className="py-3 pr-4 text-gray-400">{p.region}</td>
                <td className="py-3 pr-4 text-right text-blue-300">{p.capacity_mw.toFixed(0)}</td>
                <td className="py-3 pr-4 text-right text-amber-300">{p.capex_m.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right text-emerald-300">{p.co2_abatement_kt_yr.toFixed(0)}</td>
                <td className="py-3 pr-4 text-right text-gray-400">{p.commissioning_year}</td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[p.status] ?? 'bg-gray-600 text-gray-200'}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Load Shape Chart ----
function LoadShapeChart({ loadShapes, sector }: { loadShapes: IEPLoadShapeRecord[]; sector: string }) {
  const data = loadShapes
    .filter(r => r.sector === sector)
    .sort((a, b) => a.hour - b.hour)
    .map(r => ({
      hour: `${String(r.hour).padStart(2, '0')}:00`,
      'Current':   r.load_factor_current,
      '2030':      r.load_factor_2030,
      '2050':      r.load_factor_2050,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-1">Hourly Load Shape — {sector.replace('_', ' ')}</h2>
      <p className="text-xs text-gray-400 mb-4">Normalised load factor (0–1) by hour of day, current vs targets</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={2} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 1]} tickCount={6} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => v.toFixed(3)}
          />
          <Legend wrapperStyle={{ color: '#9ca3af' }} />
          <Line type="monotone" dataKey="Current" stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="2030"    stroke="#14b8a6" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          <Line type="monotone" dataKey="2050"    stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="8 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---- Barriers Table ----
function BarriersTable({ barriers }: { barriers: IEPBarrierRecord[] }) {
  const sorted = [...barriers].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3)
  })
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">Electrification Barriers</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700">
              <th className="pb-3 pr-4 font-medium">Barrier</th>
              <th className="pb-3 pr-4 font-medium">Severity</th>
              <th className="pb-3 pr-4 font-medium">Affected Sectors</th>
              <th className="pb-3 pr-4 font-medium">Policy Response</th>
              <th className="pb-3 font-medium text-right">Investment ($M)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(b => (
              <tr key={b.barrier} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-3 pr-4 text-white font-medium">{b.barrier.replace(/_/g, ' ')}</td>
                <td className="py-3 pr-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_BADGE[b.severity] ?? ''}`}>
                    {b.severity}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-300 text-xs max-w-xs">
                  {b.affected_sectors.join(', ')}
                </td>
                <td className="py-3 pr-4 text-gray-400 text-xs max-w-sm">{b.policy_response}</td>
                <td className="py-3 text-right text-amber-300 font-medium">
                  {b.investment_needed_m > 0 ? b.investment_needed_m.toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Investment Pathway Chart ----
function InvestmentPathwayChart({ records, sector }: { records: IEPInvestmentRecord[]; sector: string }) {
  const data = records
    .filter(r => r.sector === sector)
    .sort((a, b) => a.year - b.year)
    .map(r => ({
      year: String(r.year),
      'CAPEX':             r.capex_bn,
      'OPEX':              r.opex_bn,
      'Energy Efficiency': r.energy_efficiency_bn,
      'Grid Upgrade':      r.grid_upgrade_bn,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-1">Investment Pathway — {sector}</h2>
      <p className="text-xs text-gray-400 mb-4">Annual investment breakdown ($Bn) 2025–2034</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" Bn" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number) => `$${v.toFixed(3)}Bn`}
          />
          <Legend wrapperStyle={{ color: '#9ca3af' }} />
          <Bar dataKey="CAPEX"             stackId="a" fill="#6366f1" />
          <Bar dataKey="OPEX"              stackId="a" fill="#14b8a6" />
          <Bar dataKey="Energy Efficiency" stackId="a" fill="#10b981" />
          <Bar dataKey="Grid Upgrade"      stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---- Main Page ----
export default function IndustrialElectrificationAnalytics() {
  const [data, setData]       = useState<IEPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [loadSector, setLoadSector]   = useState('STEEL')
  const [investSector, setInvestSector] = useState('STEEL')

  useEffect(() => {
    getIndustrialElectrificationDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-gray-400 text-sm animate-pulse">Loading Industrial Electrification data...</div>
    </div>
  )

  if (error || !data) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-red-400 text-sm">Error: {error ?? 'No data'}</div>
    </div>
  )

  const s = data.summary as Record<string, number>
  const sectors = data.sectors.map(r => r.sector)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-yellow-500/20">
          <Zap className="w-6 h-6 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Industrial Electrification Pathway Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australian heavy industry decarbonisation — sector targets, projects, load shapes &amp; investment
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Incremental Demand 2030"
          value={`${s.total_incremental_demand_twh_2030} TWh`}
          icon={TrendingUp}
          colour="bg-blue-500/20 text-blue-300"
        />
        <KpiCard
          label="Incremental Demand 2050"
          value={`${s.total_incremental_demand_twh_2050} TWh`}
          icon={TrendingUp}
          colour="bg-violet-500/20 text-violet-300"
        />
        <KpiCard
          label="Abatement Potential"
          value={`${s.total_abatement_potential_mt} Mt CO2`}
          icon={Activity}
          colour="bg-emerald-500/20 text-emerald-300"
        />
        <KpiCard
          label="Operating Projects"
          value={String(s.operating_projects)}
          sub="Live electrification projects"
          icon={Zap}
          colour="bg-yellow-500/20 text-yellow-300"
        />
        <KpiCard
          label="Committed Projects"
          value={String(s.committed_projects)}
          sub="FID taken"
          icon={AlertTriangle}
          colour="bg-orange-500/20 text-orange-300"
        />
        <KpiCard
          label="Total Investment Needed"
          value={`$${s.total_investment_needed_bn}Bn`}
          sub="Cumulative to 2050"
          icon={DollarSign}
          colour="bg-pink-500/20 text-pink-300"
        />
      </div>

      {/* Sector charts side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectorOverviewChart sectors={data.sectors} />
        <IncrementalDemandChart sectors={data.sectors} />
      </div>

      {/* Projects Table */}
      <ProjectsTable projects={data.projects} />

      {/* Load Shape */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">Sector:</label>
          <select
            value={loadSector}
            onChange={e => setLoadSector(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {sectors.map(sec => (
              <option key={sec} value={sec}>{sec.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <LoadShapeChart loadShapes={data.load_shapes} sector={loadSector} />
      </div>

      {/* Barriers */}
      <BarriersTable barriers={data.barriers} />

      {/* Investment Pathway */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">Sector:</label>
          <select
            value={investSector}
            onChange={e => setInvestSector(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {['STEEL', 'MINING', 'CHEMICALS'].map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        </div>
        <InvestmentPathwayChart records={data.investment_pathway} sector={investSector} />
      </div>
    </div>
  )
}
