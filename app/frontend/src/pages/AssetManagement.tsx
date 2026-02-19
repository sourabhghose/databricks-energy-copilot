import { useEffect, useState } from 'react'
import { Wrench } from 'lucide-react'
import {
  api,
  AssetManagementDashboard,
  TransmissionAssetRecord,
  InspectionEventRecord,
} from '../api/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Badge style maps ──────────────────────────────────────────────────────────

const CONDITION_STYLES: Record<string, { bg: string; text: string }> = {
  GOOD:     { bg: '#15803d33', text: '#4ade80' },
  FAIR:     { bg: '#92400033', text: '#fbbf24' },
  POOR:     { bg: '#c2410c33', text: '#fb923c' },
  CRITICAL: { bg: '#7f1d1d33', text: '#f87171' },
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  URGENT: { bg: '#7f1d1d33', text: '#f87171' },
  HIGH:   { bg: '#c2410c33', text: '#fb923c' },
  MEDIUM: { bg: '#92400033', text: '#fbbf24' },
  LOW:    { bg: '#15803d33', text: '#4ade80' },
}

const ASSET_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  TRANSFORMER:     { bg: '#1d4ed833', text: '#60a5fa' },
  LINE_SEGMENT:    { bg: '#0f766e33', text: '#2dd4bf' },
  SUBSTATION:      { bg: '#6d28d933', text: '#a78bfa' },
  CIRCUIT_BREAKER: { bg: '#c2410c33', text: '#fb923c' },
  CABLE:           { bg: '#0e748033', text: '#22d3ee' },
  CAPACITOR_BANK:  { bg: '#37415133', text: '#9ca3af' },
}

const MAINTENANCE_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  ON_SCHEDULE:      { bg: '#15803d33', text: '#4ade80' },
  DEFERRED:         { bg: '#92400033', text: '#fbbf24' },
  OVERDUE:          { bg: '#7f1d1d33', text: '#f87171' },
  COMPLETED_EARLY:  { bg: '#1d4ed833', text: '#60a5fa' },
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: '#7f1d1d33', text: '#f87171' },
  MAJOR:    { bg: '#c2410c33', text: '#fb923c' },
  MODERATE: { bg: '#92400033', text: '#fbbf24' },
  MINOR:    { bg: '#1d4ed833', text: '#60a5fa' },
  NONE:     { bg: '#37415133', text: '#9ca3af' },
}

const INSPECTION_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  ROUTINE:              { bg: '#1d4ed833', text: '#60a5fa' },
  CONDITION_MONITORING: { bg: '#6d28d933', text: '#a78bfa' },
  EMERGENCY:            { bg: '#7f1d1d33', text: '#f87171' },
  POST_EVENT:           { bg: '#c2410c33', text: '#fb923c' },
  DRONE:                { bg: '#0f766e33', text: '#2dd4bf' },
}

const ACTION_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  NONE:        { bg: '#37415133', text: '#9ca3af' },
  SCHEDULED:   { bg: '#92400033', text: '#fbbf24' },
  IN_PROGRESS: { bg: '#1d4ed833', text: '#60a5fa' },
  COMPLETE:    { bg: '#15803d33', text: '#4ade80' },
}

function Badge({ value, styles }: { value: string; styles: Record<string, { bg: string; text: string }> }) {
  const s = styles[value] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {value.replace(/_/g, ' ')}
    </span>
  )
}

// ── Condition colour for bar chart ────────────────────────────────────────────

function conditionColor(cat: string): string {
  if (cat === 'GOOD')     return '#4ade80'
  if (cat === 'FAIR')     return '#fbbf24'
  if (cat === 'POOR')     return '#fb923c'
  if (cat === 'CRITICAL') return '#f87171'
  return '#9ca3af'
}

function shortName(name: string): string {
  // Shorten to ~25 chars for chart labels
  return name.length > 25 ? name.slice(0, 24) + '…' : name
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssetManagement() {
  const [dash, setDash] = useState<AssetManagementDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getAssetMgmtDashboard()
      .then(setDash)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading asset management data…
      </div>
    )
  }
  if (error || !dash) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        {error ?? 'No data'}
      </div>
    )
  }

  // Prepare chart data
  const chartData = dash.assets.map(a => ({
    name: shortName(a.asset_name),
    score: a.condition_score,
    cat: a.condition_category,
  }))

  return (
    <div className="min-h-full bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wrench className="text-amber-400" size={26} />
        <div>
          <h1 className="text-xl font-bold text-white">
            Transmission Asset Management & Inspection Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Asset condition assessment, inspection regimes, maintenance cycles, predictive KPIs &amp; replacement planning
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Assets"
          value={dash.total_assets}
          sub="Monitored transmission assets"
        />
        <KpiCard
          label="Poor / Critical Assets"
          value={dash.poor_critical_assets}
          valueColor="#f87171"
          sub={`${((dash.poor_critical_assets / dash.total_assets) * 100).toFixed(0)}% of fleet`}
        />
        <KpiCard
          label="Avg Asset Age"
          value={dash.avg_asset_age_years}
          unit="yrs"
          sub="Fleet average age"
        />
        <KpiCard
          label="Maintenance Compliance"
          value={dash.maintenance_compliance_pct.toFixed(1)}
          unit="%"
          sub="Across all programs"
        />
      </div>

      {/* Asset Condition Bar Chart */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wide">
          Asset Condition Scores (0–10)
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 10]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={190}
              tick={{ fill: '#d1d5db', fontSize: 10 }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb', fontSize: 12 }}
              itemStyle={{ color: '#d1d5db', fontSize: 12 }}
              formatter={(value: number) => [value.toFixed(1), 'Condition Score']}
            />
            <Bar dataKey="score" radius={[0, 3, 3, 0]} maxBarSize={18}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={conditionColor(entry.cat)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 flex-wrap">
          {(['GOOD', 'FAIR', 'POOR', 'CRITICAL'] as const).map(c => (
            <div key={c} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: conditionColor(c) }} />
              {c}
            </div>
          ))}
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wide">
          Transmission Assets ({dash.assets.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                {[
                  'Asset Name', 'Owner', 'Type', 'kV',
                  'Age (yrs)', 'Condition', 'Priority',
                  'Replacement CAPEX (M AUD)', 'Replace Year', 'Maint. Status',
                ].map(h => (
                  <th key={h} className="text-left text-gray-400 uppercase tracking-wide pb-2 pr-4 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dash.assets.map((a: TransmissionAssetRecord) => (
                <tr key={a.asset_id} className="border-b border-gray-700/40 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 text-gray-200 font-medium max-w-xs">
                    <div className="truncate max-w-[220px]" title={a.asset_name}>{a.asset_name}</div>
                    <div className="text-gray-500 text-[10px]">{a.asset_id}</div>
                  </td>
                  <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{a.owner}</td>
                  <td className="py-2 pr-4">
                    <Badge value={a.asset_type} styles={ASSET_TYPE_STYLES} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300 tabular-nums">{a.voltage_kv}</td>
                  <td className="py-2 pr-4 text-gray-300 tabular-nums">{a.age_years}</td>
                  <td className="py-2 pr-4">
                    <Badge value={a.condition_category} styles={CONDITION_STYLES} />
                    <div className="text-gray-500 text-[10px] mt-0.5">{a.condition_score.toFixed(1)} / 10</div>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge value={a.replacement_priority} styles={PRIORITY_STYLES} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300 tabular-nums">
                    {a.replacement_capex_m_aud > 0 ? `$${a.replacement_capex_m_aud.toFixed(1)}M` : '—'}
                  </td>
                  <td className="py-2 pr-4 text-gray-300 tabular-nums">{a.replacement_year_planned}</td>
                  <td className="py-2 pr-4">
                    <Badge value={a.maintenance_status} styles={MAINTENANCE_STATUS_STYLES} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspections Table */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wide">
          Recent Inspection Events ({dash.inspections.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                {[
                  'Date', 'Asset ID', 'Type', 'Severity',
                  'Defects', 'Action Required', 'Status', 'Cost (AUD)',
                ].map(h => (
                  <th key={h} className="text-left text-gray-400 uppercase tracking-wide pb-2 pr-4 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dash.inspections.map((ins: InspectionEventRecord) => (
                <tr key={ins.inspection_id} className="border-b border-gray-700/40 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{ins.inspection_date}</td>
                  <td className="py-2 pr-4 text-gray-300 font-mono whitespace-nowrap">{ins.asset_id}</td>
                  <td className="py-2 pr-4">
                    <Badge value={ins.inspection_type} styles={INSPECTION_TYPE_STYLES} />
                  </td>
                  <td className="py-2 pr-4">
                    <Badge value={ins.severity} styles={SEVERITY_STYLES} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300 tabular-nums text-center">{ins.defects_found}</td>
                  <td className="py-2 pr-4 text-gray-400 max-w-[240px]">
                    <span title={ins.action_required}>
                      {ins.action_required.length > 50
                        ? ins.action_required.slice(0, 50) + '…'
                        : ins.action_required}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge value={ins.action_status} styles={ACTION_STATUS_STYLES} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300 tabular-nums whitespace-nowrap">
                    ${ins.inspection_cost_aud.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer timestamp */}
      <div className="text-xs text-gray-600 text-right">
        Data as at {dash.timestamp} AEST
      </div>
    </div>
  )
}
