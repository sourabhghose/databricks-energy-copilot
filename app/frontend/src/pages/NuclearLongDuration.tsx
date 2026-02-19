import { useEffect, useState } from 'react'
import { Atom } from 'lucide-react'
import {
  api,
  NuclearLongDurationDashboard,
  SmrProjectRecord,
  LongDurationStorageRecord,
  CleanFirmCapacityRecord,
} from '../api/client'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  valueColor,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold" style={{ color: valueColor ?? '#fff' }}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PROPOSED: 'bg-gray-700 text-gray-300',
    'PRE-FEASIBILITY': 'bg-blue-900 text-blue-300',
    FEASIBILITY: 'bg-amber-900 text-amber-300',
    APPROVED: 'bg-green-900 text-green-300',
  }
  const cls = styles[status] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

// ── Technology Badge (LDS) ────────────────────────────────────────────────────

function TechBadge({ tech }: { tech: string }) {
  const styles: Record<string, string> = {
    IRON_AIR: 'bg-orange-900 text-orange-300',
    FLOW_BATTERY: 'bg-cyan-900 text-cyan-300',
    COMPRESSED_AIR: 'bg-sky-900 text-sky-300',
    GRAVITY: 'bg-purple-900 text-purple-300',
    PUMPED_HYDRO: 'bg-blue-900 text-blue-300',
    LIQUID_AIR: 'bg-indigo-900 text-indigo-300',
  }
  const cls = styles[tech] ?? 'bg-gray-700 text-gray-300'
  const labels: Record<string, string> = {
    IRON_AIR: 'Iron-Air',
    FLOW_BATTERY: 'Flow Battery',
    COMPRESSED_AIR: 'Compressed Air',
    GRAVITY: 'Gravity',
    PUMPED_HYDRO: 'Pumped Hydro',
    LIQUID_AIR: 'Liquid Air',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {labels[tech] ?? tech}
    </span>
  )
}

// ── SMR Projects Table ────────────────────────────────────────────────────────

function SmrTable({ projects }: { projects: SmrProjectRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">SMR Project Pipeline</h2>
        <p className="text-xs text-gray-400 mt-0.5">Small Modular Reactor proposals across Australian states</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Developer</th>
              <th className="px-3 py-2 text-left">Technology</th>
              <th className="px-3 py-2 text-center">State</th>
              <th className="px-3 py-2 text-right">Cap (MW)</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">CAPEX ($B AUD)</th>
              <th className="px-3 py-2 text-right">LCOE ($/MWh)</th>
              <th className="px-3 py-2 text-center">First Power</th>
              <th className="px-3 py-2 text-right">CF%</th>
              <th className="px-3 py-2 text-right">CO2 (kg/MWh)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {projects.map((p) => (
              <tr key={p.project_id} className="hover:bg-gray-750 transition-colors">
                <td className="px-3 py-2 font-medium text-white">{p.project_name}</td>
                <td className="px-3 py-2 text-gray-400">{p.developer}</td>
                <td className="px-3 py-2">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-violet-900 text-violet-300">
                    {p.technology}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 text-[10px] font-mono">
                    {p.state}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.capacity_mw.toLocaleString()}</td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.capex_b_aud.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-400">{p.lcoe_mwh.toFixed(0)}</td>
                <td className="px-3 py-2 text-center tabular-nums text-gray-300">
                  {p.first_power_year ?? '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-green-400">{p.cf_pct.toFixed(1)}%</td>
                <td className="px-3 py-2 text-right tabular-nums text-teal-400">{p.co2_intensity_kg_mwh.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Long-Duration Storage Table ───────────────────────────────────────────────

function LdsTable({ projects }: { projects: LongDurationStorageRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">Long-Duration Storage Pipeline</h2>
        <p className="text-xs text-gray-400 mt-0.5">Multi-technology storage projects enabling clean firm capacity</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300">
          <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Technology</th>
              <th className="px-3 py-2 text-left">Developer</th>
              <th className="px-3 py-2 text-center">State</th>
              <th className="px-3 py-2 text-right">Cap (MWh)</th>
              <th className="px-3 py-2 text-right">Power (MW)</th>
              <th className="px-3 py-2 text-right">Duration (h)</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">LCOS ($/MWh)</th>
              <th className="px-3 py-2 text-right">RTE%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {projects.map((p) => (
              <tr key={p.project_id} className="hover:bg-gray-750 transition-colors">
                <td className="px-3 py-2 font-medium text-white">{p.project_name}</td>
                <td className="px-3 py-2">
                  <TechBadge tech={p.technology} />
                </td>
                <td className="px-3 py-2 text-gray-400">{p.developer}</td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 text-[10px] font-mono">
                    {p.state}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.capacity_mwh.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.power_mw.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums text-cyan-400">{p.duration_hours.toFixed(0)}h</td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-400">{p.lcos_mwh.toFixed(0)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-green-400">{p.round_trip_efficiency_pct.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Clean Firm Capacity Outlook Chart ─────────────────────────────────────────

function CapacityOutlookChart({ data }: { data: CleanFirmCapacityRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-white mb-1">Clean Firm Capacity Outlook (2025–2040)</h2>
      <p className="text-xs text-gray-400 mb-4">Projected firm low-carbon capacity by technology (GW)</p>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nuclearGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="ldsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="phesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="gasCcsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="h2Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GW" width={60} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
            labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(value: number, name: string) => [`${value.toFixed(1)} GW`, name]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="pumped_hydro_gw"
            name="Pumped Hydro"
            stackId="1"
            stroke="#60a5fa"
            fill="url(#phesGrad)"
          />
          <Area
            type="monotone"
            dataKey="long_duration_storage_gw"
            name="Long-Duration Storage"
            stackId="1"
            stroke="#22d3ee"
            fill="url(#ldsGrad)"
          />
          <Area
            type="monotone"
            dataKey="gas_ccs_gw"
            name="Gas + CCS"
            stackId="1"
            stroke="#f59e0b"
            fill="url(#gasCcsGrad)"
          />
          <Area
            type="monotone"
            dataKey="hydrogen_peaker_gw"
            name="Hydrogen Peaker"
            stackId="1"
            stroke="#34d399"
            fill="url(#h2Grad)"
          />
          <Area
            type="monotone"
            dataKey="nuclear_gw"
            name="Nuclear SMR"
            stackId="1"
            stroke="#a78bfa"
            fill="url(#nuclearGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NuclearLongDuration() {
  const [dashboard, setDashboard] = useState<NuclearLongDurationDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getNuclearLdesDashboard()
      .then((d) => {
        setDashboard(d)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-violet-900 rounded-lg">
          <Atom size={24} className="text-violet-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Nuclear SMR &amp; Long-Duration Energy Storage</h1>
          <p className="text-sm text-gray-400">
            Clean firm capacity investment pipeline — SMR projects and long-duration storage across the NEM
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="text-gray-400 text-sm animate-pulse">Loading dashboard data...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-6">
          Error loading data: {error}
        </div>
      )}

      {dashboard && (
        <div className="flex flex-col gap-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total SMR Pipeline"
              value={dashboard.total_smr_pipeline_gw.toFixed(2)}
              unit="GW"
              sub={`${dashboard.smr_projects.length} projects`}
              valueColor="#a78bfa"
            />
            <KpiCard
              label="Total LDES Pipeline"
              value={dashboard.total_lds_pipeline_gwh.toFixed(2)}
              unit="GWh"
              sub={`${dashboard.long_duration_projects.length} projects`}
              valueColor="#22d3ee"
            />
            <KpiCard
              label="Avg SMR LCOE"
              value={dashboard.avg_smr_lcoe.toFixed(1)}
              unit="$/MWh"
              sub="Levelised cost of energy"
              valueColor="#f59e0b"
            />
            <KpiCard
              label="Avg LDES LCOS"
              value={dashboard.avg_lds_lcos.toFixed(1)}
              unit="$/MWh"
              sub="Levelised cost of storage"
              valueColor="#34d399"
            />
          </div>

          {/* Capacity Outlook Chart */}
          <CapacityOutlookChart data={dashboard.capacity_outlook} />

          {/* SMR Projects Table */}
          <SmrTable projects={dashboard.smr_projects} />

          {/* Long-Duration Storage Table */}
          <LdsTable projects={dashboard.long_duration_projects} />

          {/* Footer timestamp */}
          <div className="text-xs text-gray-600 text-right">
            Data as of {new Date(dashboard.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
          </div>
        </div>
      )}
    </div>
  )
}
