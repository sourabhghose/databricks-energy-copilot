import { useState, useEffect } from 'react'
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
  Cell,
} from 'recharts'
import { GitBranch } from 'lucide-react'
import {
  getPowerGridTopologyDashboard,
  type PGTADashboard,
} from '../api/client'

// ── Colour helpers ─────────────────────────────────────────────────────────

const CONDITION_COLOURS: Record<string, string> = {
  Good:     '#10b981',
  Fair:     '#f59e0b',
  Poor:     '#f97316',
  Critical: '#ef4444',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#10b981',
  SA1:  '#8b5cf6',
  TAS1: '#06b6d4',
}

const CASCADING_COLOURS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f97316',
  Low:    '#10b981',
}

const YEAR_COLOURS: Record<number, string> = {
  2022: '#3b82f6',
  2023: '#f59e0b',
  2024: '#10b981',
}

const MONTH_LABELS: Record<number, string> = { 1: 'Q1', 4: 'Q2', 7: 'Q3', 10: 'Q4' }

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function PowerGridTopologyAnalytics() {
  const [data, setData] = useState<PGTADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPowerGridTopologyDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <GitBranch size={28} className="animate-spin mr-3 text-cyan-400" />
        Loading power grid topology data…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const { nodes, lines, contingencies, capacity_utilisation, reliability_metrics, summary } = data

  // ── Chart 1: Nodes by voltage_kv and connected_lines grouped by region ──
  const nodesByVoltage = nodes.map(n => ({
    name: n.node_name.length > 20 ? n.node_name.slice(0, 18) + '…' : n.node_name,
    connected_lines: n.connected_lines,
    voltage_kv: n.voltage_kv,
    region: n.region,
  }))

  // ── Chart 2: Lines sorted by current_flow_pct coloured by condition ──
  const linesSorted = [...lines].sort((a, b) => b.current_flow_pct - a.current_flow_pct)

  // ── Chart 3: Contingency impact_mw by element_type and cascading_risk ──
  const contingencyByType: Record<string, Record<string, number>> = {}
  for (const c of contingencies) {
    if (!contingencyByType[c.element_type]) {
      contingencyByType[c.element_type] = { High: 0, Medium: 0, Low: 0, count: 0 }
    }
    contingencyByType[c.element_type][c.cascading_risk] =
      (contingencyByType[c.element_type][c.cascading_risk] ?? 0) + c.impact_mw
    contingencyByType[c.element_type].count += 1
  }
  const contingencyChartData = Object.entries(contingencyByType).map(([etype, vals]) => ({
    element_type: etype,
    High: Math.round(vals.High ?? 0),
    Medium: Math.round(vals.Medium ?? 0),
    Low: Math.round(vals.Low ?? 0),
  }))

  // ── Chart 4: Peak utilisation quarterly trend by region ──
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const nodeRegionMap: Record<string, string> = {}
  for (const n of nodes) {
    nodeRegionMap[n.node_id] = n.region
  }
  // Build data keyed by year-quarter with region averages
  type UtilPoint = { key: string; year: number; month: number } & Record<string, number>
  const utilMap: Record<string, UtilPoint> = {}
  for (const cu of capacity_utilisation) {
    const reg = nodeRegionMap[cu.node_id]
    if (!reg) continue
    const key = `${cu.year}-${MONTH_LABELS[cu.month]}`
    if (!utilMap[key]) {
      utilMap[key] = { key, year: cu.year, month: cu.month } as UtilPoint
    }
    if (utilMap[key][`${reg}_sum`] === undefined) {
      utilMap[key][`${reg}_sum`] = 0
      utilMap[key][`${reg}_count`] = 0
    }
    utilMap[key][`${reg}_sum`] = (utilMap[key][`${reg}_sum`] ?? 0) + cu.peak_utilisation_pct
    utilMap[key][`${reg}_count`] = (utilMap[key][`${reg}_count`] ?? 0) + 1
  }
  const utilTrend = Object.values(utilMap)
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map(pt => {
      const out: Record<string, string | number> = { key: pt.key }
      for (const reg of regions) {
        const s = (pt[`${reg}_sum`] as number) ?? 0
        const c = (pt[`${reg}_count`] as number) ?? 0
        out[reg] = c > 0 ? Math.round((s / c) * 10) / 10 : 0
      }
      return out
    })

  // ── Chart 5: SAIDI by region x year (grouped bar) ──
  const saidiByRegion: Record<string, Record<number, number>> = {}
  for (const rm of reliability_metrics) {
    if (!saidiByRegion[rm.region]) saidiByRegion[rm.region] = {}
    saidiByRegion[rm.region][rm.year] = rm.saidi_mins
  }
  const saidiChartData = Object.entries(saidiByRegion).map(([reg, years]) => ({
    region: reg,
    '2022': Math.round(years[2022] ?? 0),
    '2023': Math.round(years[2023] ?? 0),
    '2024': Math.round(years[2024] ?? 0),
  }))

  return (
    <div className="bg-gray-900 min-h-screen p-6 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <GitBranch size={28} className="text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold">Power Grid Topology &amp; Network Analytics</h1>
          <p className="text-sm text-gray-400">NEM transmission network topology, contingency analysis &amp; reliability metrics</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total Nodes" value={summary.total_nodes} sub="transmission nodes" />
        <KpiCard label="Total Lines" value={summary.total_lines} sub="transmission lines" />
        <KpiCard
          label="Avg Line Utilisation"
          value={`${summary.avg_line_utilisation_pct}%`}
          sub="current flow vs thermal limit"
        />
        <KpiCard
          label="N-1 Secure"
          value={`${summary.n_minus_1_secure_pct}%`}
          sub="of nodes N-1 contingency secure"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Nodes — connected lines by region */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Node Connected Lines by Region
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={nodesByVoltage} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Lines', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="connected_lines" name="Connected Lines" radius={[3, 3, 0, 0]}>
                {nodesByVoltage.map((entry, idx) => (
                  <Cell key={idx} fill={REGION_COLOURS[entry.region] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {Object.entries(REGION_COLOURS).map(([reg, colour]) => (
              <span key={reg} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
                {reg}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 2: Lines sorted by current_flow_pct coloured by condition */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Transmission Lines — Current Flow % (sorted, coloured by condition)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={linesSorted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="line_id" tick={{ fill: '#9ca3af', fontSize: 9 }} interval={4} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                domain={[0, 100]}
                label={{ value: 'Flow %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(val: number, _name: string, props: { payload?: { condition?: string } }) => [
                  `${val}%`,
                  `Flow (${props.payload?.condition ?? ''})`,
                ]}
              />
              <Bar dataKey="current_flow_pct" name="Current Flow %" radius={[2, 2, 0, 0]}>
                {linesSorted.map((entry, idx) => (
                  <Cell key={idx} fill={CONDITION_COLOURS[entry.condition] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {Object.entries(CONDITION_COLOURS).map(([cond, colour]) => (
              <span key={cond} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
                {cond}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 3: Contingency impact by element type and cascading risk */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Contingency Impact (MW) by Element Type &amp; Cascading Risk
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={contingencyChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="element_type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                label={{ value: 'Impact MW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="High"   name="High Risk"   fill={CASCADING_COLOURS.High}   stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Medium" name="Medium Risk" fill={CASCADING_COLOURS.Medium} stackId="a" />
              <Bar dataKey="Low"    name="Low Risk"    fill={CASCADING_COLOURS.Low}    stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Peak utilisation quarterly trend by region */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Peak Utilisation % — Quarterly Trend 2022–2024 by Region
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={utilTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="key" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                domain={[0, 100]}
                label={{ value: 'Peak %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {regions.map(reg => (
                <Line
                  key={reg}
                  type="monotone"
                  dataKey={reg}
                  stroke={REGION_COLOURS[reg]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5: SAIDI by region x year (grouped bar) */}
        <div className="bg-gray-800 rounded-lg p-4 xl:col-span-2">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            SAIDI (mins) — System Average Interruption Duration by Region &amp; Year
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={saidiChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                label={{ value: 'SAIDI (mins)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="2022" name="2022" fill={YEAR_COLOURS[2022]} radius={[2, 2, 0, 0]} />
              <Bar dataKey="2023" name="2023" fill={YEAR_COLOURS[2023]} radius={[2, 2, 0, 0]} />
              <Bar dataKey="2024" name="2024" fill={YEAR_COLOURS[2024]} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary footer */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4 text-sm text-gray-400 grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><span className="text-gray-500">Most Critical Node:</span> <span className="text-white font-medium">{summary.most_critical_node}</span></div>
        <div><span className="text-gray-500">Total Thermal Limit:</span> <span className="text-white font-medium">{summary.total_thermal_limit_gw} GW</span></div>
        <div><span className="text-gray-500">Longest Line:</span> <span className="text-white font-medium">{summary.longest_line_km} km</span></div>
      </div>
    </div>
  )
}
