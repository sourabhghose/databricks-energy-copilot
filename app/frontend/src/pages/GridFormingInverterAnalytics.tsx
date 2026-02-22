import { useEffect, useState } from 'react'
import { Cpu } from 'lucide-react'
import {
  getGridFormingInverterXDashboard,
  GFIAXDashboard,
  GFIAXSystemStrengthRecord,
  GFIAXDeploymentRecord,
} from '../api/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
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

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({
  label,
  style,
}: {
  label: string
  style: { bg: string; text: string }
}) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {label}
    </span>
  )
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  Adequate:  { bg: '#14532d33', text: '#4ade80' },
  Marginal:  { bg: '#78350f33', text: '#fbbf24' },
  Deficient: { bg: '#7f1d1d33', text: '#f87171' },
}

const AVAIL_STYLES: Record<string, { bg: string; text: string }> = {
  Available:   { bg: '#14532d33', text: '#4ade80' },
  Development: { bg: '#1e3a8a33', text: '#60a5fa' },
  Research:    { bg: '#581c8733', text: '#c084fc' },
}

function BoolIcon({ value }: { value: boolean }) {
  return (
    <span style={{ color: value ? '#4ade80' : '#f87171' }} className="font-bold text-sm">
      {value ? '✓' : '✗'}
    </span>
  )
}

// ── System Strength Chart ─────────────────────────────────────────────────────

function SystemStrengthChart({ data }: { data: GFIAXSystemStrengthRecord[] }) {
  const chartData = data.map((s) => ({
    name: s.region + '\n' + s.measurement_point.split(' ').slice(0, 2).join(' '),
    label: s.measurement_point.substring(0, 22),
    current: Math.round(s.fault_level_mva),
    requirement: s.aemo_requirement_mva,
    status: s.system_strength_status,
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        System Strength: Current Fault Level vs AEMO Requirement (MVA)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 60, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MVA" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#9ca3af' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          <Bar dataKey="current" name="Current Fault Level" fill="#60a5fa" radius={[3, 3, 0, 0]} />
          <Bar dataKey="requirement" name="AEMO Requirement" fill="#f87171" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── GFM Capacity by Technology ────────────────────────────────────────────────

function GfmCapacityByTechnology({ deployments }: { deployments: GFIAXDeploymentRecord[] }) {
  const techMap: Record<string, number> = {}
  for (const d of deployments) {
    if (d.capacity_mw > 0) {
      techMap[d.technology] = (techMap[d.technology] ?? 0) + d.capacity_mw
    }
  }
  const chartData = Object.entries(techMap)
    .map(([tech, mw]) => ({ tech: tech.length > 22 ? tech.substring(0, 22) + '…' : tech, mw: Math.round(mw) }))
    .sort((a, b) => b.mw - a.mw)

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        GFM Deployment Capacity by Technology (MW)
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
          <YAxis type="category" dataKey="tech" tick={{ fill: '#9ca3af', fontSize: 10 }} width={160} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#9ca3af' }}
          />
          <Bar dataKey="mw" name="Capacity (MW)" fill="#4ade80" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Cost-Benefit BCR by Scenario ──────────────────────────────────────────────

function CostBenefitBcrChart({ costBenefits }: { costBenefits: GFIAXDashboard['cost_benefits'] }) {
  const scenarios = ['No GFM', '10% GFM', '30% GFM', '50% GFM', '100% GFM']
  const regions = ['SA', 'VIC', 'NSW', 'QLD']
  const colors = ['#f87171', '#60a5fa', '#4ade80', '#fbbf24']

  const chartData = scenarios.map((scen) => {
    const row: Record<string, string | number> = { scenario: scen }
    for (const reg of regions) {
      const rec = costBenefits.find((cb) => cb.region === reg && cb.scenario === scen)
      row[reg] = rec ? rec.bcr : 0
    }
    return row
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        Cost-Benefit Analysis: BCR by GFM Penetration Scenario
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="scenario" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'BCR', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#9ca3af' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          <ReferenceLine y={1} stroke="#fbbf24" strokeDasharray="4 2" label={{ value: 'BCR=1 (Break-even)', fill: '#fbbf24', fontSize: 10 }} />
          {regions.map((reg, i) => (
            <Bar key={reg} dataKey={reg} name={reg} fill={colors[i]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Performance Comparison Chart ──────────────────────────────────────────────

function PerformanceComparisonChart({ performance }: { performance: GFIAXDashboard['performance'] }) {
  const byEventType: Record<string, { gfm: number[]; gfl_implied: number[] }> = {}
  for (const p of performance) {
    if (!byEventType[p.event_type]) byEventType[p.event_type] = { gfm: [], gfl_implied: [] }
    byEventType[p.event_type].gfm.push(p.response_time_ms)
    // GFL implied from comparison_vs_gfl_pct: GFM is faster by comparison_vs_gfl_pct%
    byEventType[p.event_type].gfl_implied.push(p.response_time_ms * (1 + p.comparison_vs_gfl_pct / 100))
  }

  const chartData = Object.entries(byEventType).map(([evType, vals]) => {
    const avgGfm = Math.round(vals.gfm.reduce((a, b) => a + b, 0) / vals.gfm.length)
    const avgGfl = Math.round(vals.gfl_implied.reduce((a, b) => a + b, 0) / vals.gfl_implied.length)
    return { event: evType.length > 16 ? evType.substring(0, 16) + '…' : evType, gfm_ms: avgGfm, gfl_ms: avgGfl }
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        Performance Comparison: GFM vs GFL Average Response Time (ms)
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="event" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" ms" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            itemStyle={{ color: '#9ca3af' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          <Bar dataKey="gfm_ms" name="GFM (ms)" fill="#4ade80" radius={[3, 3, 0, 0]} />
          <Bar dataKey="gfl_ms" name="GFL (ms)" fill="#f87171" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── System Strength Status Table ──────────────────────────────────────────────

function SystemStrengthTable({ data }: { data: GFIAXSystemStrengthRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        System Strength Status by Region / Measurement Point
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
              <th className="text-left pb-2 pr-3">Region</th>
              <th className="text-left pb-2 pr-3">Measurement Point</th>
              <th className="text-right pb-2 pr-3">SCR</th>
              <th className="text-right pb-2 pr-3">Fault Level (MVA)</th>
              <th className="text-right pb-2 pr-3">AEMO Req (MVA)</th>
              <th className="text-right pb-2 pr-3">Gap (MVA)</th>
              <th className="text-right pb-2 pr-3">IBR Pen. %</th>
              <th className="text-left pb-2 pr-3">Status</th>
              <th className="text-center pb-2">Remediation</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.strength_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 font-medium text-white">{s.region}</td>
                <td className="py-2 pr-3 text-gray-400 text-xs">{s.measurement_point}</td>
                <td className="py-2 pr-3 text-right font-mono text-blue-400">{s.short_circuit_ratio.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right">{s.fault_level_mva.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-gray-400">{s.aemo_requirement_mva.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right" style={{ color: s.gap_mva > 0 ? '#f87171' : '#4ade80' }}>
                  {s.gap_mva > 0 ? `−${s.gap_mva}` : '✓'}
                </td>
                <td className="py-2 pr-3 text-right text-amber-400">{s.ibr_penetration_pct.toFixed(1)}%</td>
                <td className="py-2 pr-3">
                  <Badge
                    label={s.system_strength_status}
                    style={STATUS_STYLES[s.system_strength_status] ?? { bg: '#37415133', text: '#9ca3af' }}
                  />
                </td>
                <td className="py-2 text-center"><BoolIcon value={s.remediation_required} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── GFM Deployments Table ─────────────────────────────────────────────────────

function GfmDeploymentsTable({ deployments }: { deployments: GFIAXDeploymentRecord[] }) {
  const sorted = [...deployments]
    .filter((d) => d.capacity_mw > 0)
    .sort((a, b) => b.capacity_mw - a.capacity_mw)
    .slice(0, 12)

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        GFM Deployments Summary (Top 12 by Capacity)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
              <th className="text-left pb-2 pr-3">Asset Name</th>
              <th className="text-left pb-2 pr-3">Region</th>
              <th className="text-left pb-2 pr-3">Technology</th>
              <th className="text-left pb-2 pr-3">Application</th>
              <th className="text-right pb-2 pr-3">Capacity (MW)</th>
              <th className="text-right pb-2 pr-3">Inertia (MWs)</th>
              <th className="text-right pb-2 pr-3">Sys Str. (MVA)</th>
              <th className="text-right pb-2 pr-3">Year</th>
              <th className="text-right pb-2 pr-3">Cost ($M)</th>
              <th className="text-center pb-2">GC Comply</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.deployment_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 font-medium text-white text-xs">{d.asset_name}</td>
                <td className="py-2 pr-3 text-gray-400">{d.region}</td>
                <td className="py-2 pr-3 text-blue-400 text-xs">{d.technology.length > 20 ? d.technology.substring(0, 20) + '…' : d.technology}</td>
                <td className="py-2 pr-3 text-gray-400 text-xs">{d.application}</td>
                <td className="py-2 pr-3 text-right text-green-400 font-semibold">{d.capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-blue-300">{d.inertia_contribution_mws.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right">{d.system_strength_mva.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-gray-400">{d.commissioning_year}</td>
                <td className="py-2 pr-3 text-right text-amber-400">${d.project_cost_m}M</td>
                <td className="py-2 text-center"><BoolIcon value={d.grid_code_compliance} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GridFormingInverterAnalytics() {
  const [data, setData] = useState<GFIAXDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGridFormingInverterXDashboard()
      .then(setData)
      .catch((err) => setError(err.message ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading Grid-Forming Inverter Technology Analytics...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-sm">{error ?? 'No data available'}</div>
      </div>
    )
  }

  const s = data.summary

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Cpu className="text-blue-400" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Grid Forming Inverter Technology Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            GFM technology deployments, system strength, performance benchmarking, cost-benefit analysis and regulatory compliance across the NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total GFM Capacity"
          value={(s.total_gfm_capacity_gw as number).toFixed(2)}
          unit="GW"
          sub={`${s.gfm_deployments_count} GFM deployments`}
          valueColor="#4ade80"
        />
        <KpiCard
          label="Regions with Deficiency"
          value={String(s.regions_with_deficiency)}
          sub="System strength deficient"
          valueColor={(s.regions_with_deficiency as number) > 0 ? '#f87171' : '#4ade80'}
        />
        <KpiCard
          label="Avg SCR (NEM)"
          value={(s.avg_scr_nem as number).toFixed(2)}
          sub="Short circuit ratio"
          valueColor={(s.avg_scr_nem as number) >= 3 ? '#4ade80' : (s.avg_scr_nem as number) >= 1.8 ? '#fbbf24' : '#f87171'}
        />
        <KpiCard
          label="Total System Inertia"
          value={((s.total_inertia_mws as number) / 1000).toFixed(1)}
          unit="GWs"
          sub="Across measured points"
          valueColor="#60a5fa"
        />
      </div>

      {/* System Strength Charts side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SystemStrengthChart data={data.system_strength} />
        <GfmCapacityByTechnology deployments={data.deployments} />
      </div>

      {/* Cost-Benefit and Performance side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CostBenefitBcrChart costBenefits={data.cost_benefits} />
        <PerformanceComparisonChart performance={data.performance} />
      </div>

      {/* System Strength Status Table */}
      <SystemStrengthTable data={data.system_strength} />

      {/* GFM Deployments Table */}
      <GfmDeploymentsTable deployments={data.deployments} />
    </div>
  )
}
