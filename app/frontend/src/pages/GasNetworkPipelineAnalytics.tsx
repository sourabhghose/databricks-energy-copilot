import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getGasNetworkPipelineDashboard,
  GNPIDashboard,
  GNPIPipeline,
  GNPIFlow,
  GNPIStorageFacility,
  GNPICapacity,
  GNPIInvestment,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const PIPELINE_TYPE_COLORS: Record<string, string> = {
  Transmission: '#6366f1',
  Distribution: '#22c55e',
  Lateral:      '#f59e0b',
  Storage:      '#06b6d4',
}

const FACILITY_TYPE_COLORS: Record<string, string> = {
  'Underground Storage': '#6366f1',
  'LNG Peaking':         '#f59e0b',
  'Linepack':            '#22c55e',
  'Salt Cavern':         '#ec4899',
}

const INVESTMENT_TYPE_COLORS: Record<string, string> = {
  Expansion:       '#6366f1',
  Compression:     '#22c55e',
  Safety:          '#ef4444',
  Metering:        '#f59e0b',
  Integrity:       '#06b6d4',
  'Hydrogen-ready':'#8b5cf6',
}

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4']

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 1 — Pipeline design capacity coloured by pipeline_type
// ---------------------------------------------------------------------------

function PipelineCapacityChart({ pipelines }: { pipelines: GNPIPipeline[] }) {
  const data = [...pipelines]
    .sort((a, b) => b.design_capacity_tj_per_day - a.design_capacity_tj_per_day)
    .map(p => ({
      name: p.pipeline_name.length > 22 ? p.pipeline_name.slice(0, 22) + '…' : p.pipeline_name,
      design_capacity_tj_per_day: p.design_capacity_tj_per_day,
      pipeline_type: p.pipeline_type,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Pipeline Design Capacity (TJ/day) by Type
      </h3>
      <div className="flex flex-wrap gap-3 mb-3">
        {Object.entries(PIPELINE_TYPE_COLORS).map(([type, colour]) => (
          <span key={type} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
            {type}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number) => [`${v.toFixed(1)} TJ/day`, 'Design Capacity']}
          />
          <Bar dataKey="design_capacity_tj_per_day" radius={[3, 3, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={PIPELINE_TYPE_COLORS[entry.pipeline_type] ?? '#6366f1'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Monthly utilisation trend 2022-2024 for 5 key pipelines
// ---------------------------------------------------------------------------

function UtilisationTrendChart({
  flows,
  pipelines,
}: {
  flows: GNPIFlow[]
  pipelines: GNPIPipeline[]
}) {
  // Build a set of unique pipeline IDs present in flows
  const pipelineIds = [...new Set(flows.map(f => f.pipeline_id))]

  // Build time axis: year-month labels
  const timeKeys = [...new Set(flows.map(f => `${f.year}-M${String(f.month).padStart(2, '0')}`))]
    .sort()

  const chartData = timeKeys.map(tk => {
    const [yearStr, monthPart] = tk.split('-')
    const yr = parseInt(yearStr)
    const mo = parseInt(monthPart.replace('M', ''))
    const entry: Record<string, number | string> = { period: tk }
    pipelineIds.forEach(pid => {
      const flow = flows.find(f => f.pipeline_id === pid && f.year === yr && f.month === mo)
      if (flow) entry[pid] = flow.utilisation_pct
    })
    return entry
  })

  const pipelineNameMap: Record<string, string> = {}
  pipelineIds.forEach(pid => {
    const p = pipelines.find(p => p.pipeline_id === pid)
    pipelineNameMap[pid] = p
      ? (p.pipeline_name.length > 16 ? p.pipeline_name.slice(0, 16) + '…' : p.pipeline_name)
      : pid
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Monthly Utilisation (%) Trend 2022-2024 — Key Pipelines
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="period"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, pipelineNameMap[name] ?? name]}
          />
          <Legend
            formatter={(value: string) => pipelineNameMap[value] ?? value}
            wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}
          />
          {pipelineIds.map((pid, idx) => (
            <Line
              key={pid}
              type="monotone"
              dataKey={pid}
              stroke={LINE_COLORS[idx % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Storage facility working_gas_pj coloured by facility_type
// ---------------------------------------------------------------------------

function StorageCapacityChart({ storage }: { storage: GNPIStorageFacility[] }) {
  const data = [...storage]
    .sort((a, b) => b.working_gas_pj - a.working_gas_pj)
    .map(sf => ({
      name: sf.facility_name.length > 22 ? sf.facility_name.slice(0, 22) + '…' : sf.facility_name,
      working_gas_pj: sf.working_gas_pj,
      facility_type: sf.facility_type,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Storage Facility Working Gas Capacity (PJ) by Type
      </h3>
      <div className="flex flex-wrap gap-3 mb-3">
        {Object.entries(FACILITY_TYPE_COLORS).map(([type, colour]) => (
          <span key={type} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
            {type}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number) => [`${v.toFixed(2)} PJ`, 'Working Gas']}
          />
          <Bar dataKey="working_gas_pj" radius={[3, 3, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={FACILITY_TYPE_COLORS[entry.facility_type] ?? '#6366f1'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Quarterly firm/interruptible/uncontracted capacity stacked bar
// ---------------------------------------------------------------------------

function CapacityStackedChart({ capacity, pipelines }: { capacity: GNPICapacity[]; pipelines: GNPIPipeline[] }) {
  const pipelineIds = [...new Set(capacity.map(c => c.pipeline_id))]

  const data = capacity.map(c => {
    const p = pipelines.find(pp => pp.pipeline_id === c.pipeline_id)
    const shortName = p
      ? (p.pipeline_name.length > 14 ? p.pipeline_name.slice(0, 14) + '…' : p.pipeline_name)
      : c.pipeline_id
    return {
      period: `${shortName} ${c.year} ${c.quarter}`,
      firm_capacity_tj: c.firm_capacity_tj,
      interruptible_capacity_tj: c.interruptible_capacity_tj,
      uncontracted_capacity_tj: c.uncontracted_capacity_tj,
    }
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Quarterly Capacity Breakdown — Firm / Interruptible / Uncontracted (TJ)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="period"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number, name: string) => [
              `${v.toFixed(1)} TJ`,
              name.replace(/_/g, ' ').replace(' capacity tj', ''),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
          <Bar dataKey="firm_capacity_tj" stackId="a" fill="#6366f1" name="Firm" radius={[0, 0, 0, 0]} />
          <Bar dataKey="interruptible_capacity_tj" stackId="a" fill="#f59e0b" name="Interruptible" />
          <Bar dataKey="uncontracted_capacity_tj" stackId="a" fill="#374151" name="Uncontracted" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Investment capex_m_aud coloured by investment_type
// ---------------------------------------------------------------------------

function InvestmentCapexChart({ investments }: { investments: GNPIInvestment[] }) {
  const data = [...investments]
    .sort((a, b) => b.capex_m_aud - a.capex_m_aud)
    .map(inv => ({
      name: inv.project_name.length > 22 ? inv.project_name.slice(0, 22) + '…' : inv.project_name,
      capex_m_aud: inv.capex_m_aud,
      investment_type: inv.investment_type,
      status: inv.status,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Investment Capex (M AUD) by Type
      </h3>
      <div className="flex flex-wrap gap-3 mb-3">
        {Object.entries(INVESTMENT_TYPE_COLORS).map(([type, colour]) => (
          <span key={type} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
            {type}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            formatter={(v: number) => [`$${v.toFixed(1)}M AUD`, 'Capex']}
          />
          <Bar dataKey="capex_m_aud" radius={[3, 3, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={INVESTMENT_TYPE_COLORS[entry.investment_type] ?? '#6366f1'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GasNetworkPipelineAnalytics() {
  const [data, setData] = useState<GNPIDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGasNetworkPipelineDashboard()
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">Loading Gas Network Pipeline Analytics…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">{error ?? 'Unknown error'}</div>
      </div>
    )
  }

  const { pipelines, flows, storage_facilities, capacity, investments, summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2 bg-indigo-600 rounded-lg">
          <GitBranch className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Gas Network Pipeline Infrastructure Analytics</h1>
          <p className="text-sm text-gray-400">Australian gas transmission &amp; distribution network — GNPI</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Pipelines"
          value={String(summary.total_pipelines)}
          sub="Across all types"
        />
        <KpiCard
          label="Total Network KM"
          value={summary.total_network_km.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
          sub="Combined pipeline length"
        />
        <KpiCard
          label="Avg Utilisation %"
          value={`${summary.avg_utilisation_pct.toFixed(1)}%`}
          sub="Across all pipelines"
        />
        <KpiCard
          label="Total Storage PJ"
          value={summary.total_storage_pj.toFixed(1)}
          sub="Working gas capacity"
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Total Investment"
          value={`$${summary.total_investment_m_aud.toFixed(0)}M AUD`}
          sub="Combined capex pipeline"
        />
        <KpiCard
          label="Longest Pipeline"
          value={`${summary.longest_pipeline_km.toFixed(0)} km`}
          sub="Single pipeline"
        />
        <KpiCard
          label="Most Utilised"
          value={summary.most_utilised_pipeline.length > 24
            ? summary.most_utilised_pipeline.slice(0, 24) + '…'
            : summary.most_utilised_pipeline}
          sub="Highest utilisation %"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PipelineCapacityChart pipelines={pipelines} />
        <UtilisationTrendChart flows={flows} pipelines={pipelines} />
        <StorageCapacityChart storage={storage_facilities} />
        <CapacityStackedChart capacity={capacity} pipelines={pipelines} />
      </div>

      {/* Full-width investment chart */}
      <div className="mt-6">
        <InvestmentCapexChart investments={investments} />
      </div>
    </div>
  )
}
