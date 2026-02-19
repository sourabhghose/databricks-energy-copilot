import { useEffect, useState } from 'react'
import { CloudLightning } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { apiClient, ClimateRiskDashboard, NetworkAssetRiskRecord, ClimateEventRecord } from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

function riskColor(category: string): string {
  switch (category) {
    case 'CRITICAL': return '#ef4444'
    case 'HIGH':     return '#f97316'
    case 'MODERATE': return '#eab308'
    default:         return '#22c55e'
  }
}

function riskBadge(category: string) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-700 text-red-100',
    HIGH:     'bg-orange-700 text-orange-100',
    MODERATE: 'bg-yellow-700 text-yellow-100',
    LOW:      'bg-green-700 text-green-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[category] ?? 'bg-gray-700 text-gray-100'}`}>
      {category}
    </span>
  )
}

function adaptationBadge(status: string) {
  const colors: Record<string, string> = {
    COMPLETE:    'bg-green-700 text-green-100',
    IN_PROGRESS: 'bg-blue-700 text-blue-100',
    PLANNED:     'bg-yellow-700 text-yellow-100',
    NOT_STARTED: 'bg-gray-700 text-gray-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[status] ?? 'bg-gray-700 text-gray-100'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function assetTypeBadge(type: string) {
  const colors: Record<string, string> = {
    SUBSTATION:       'bg-purple-700 text-purple-100',
    TRANSMISSION_LINE:'bg-indigo-700 text-indigo-100',
    DISTRIBUTION_ZONE:'bg-teal-700 text-teal-100',
    GENERATION_SITE:  'bg-amber-700 text-amber-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[type] ?? 'bg-gray-700 text-gray-100'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function eventTypeBadge(type: string) {
  const colors: Record<string, string> = {
    FLOOD:    'bg-blue-700 text-blue-100',
    BUSHFIRE: 'bg-red-700 text-red-100',
    HEATWAVE: 'bg-orange-700 text-orange-100',
    STORM:    'bg-teal-700 text-teal-100',
    CYCLONE:  'bg-purple-700 text-purple-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[type] ?? 'bg-gray-700 text-gray-100'}`}>
      {type}
    </span>
  )
}

function severityBadge(severity: string) {
  const colors: Record<string, string> = {
    EXTREME:  'bg-red-700 text-red-100',
    SEVERE:   'bg-orange-700 text-orange-100',
    MODERATE: 'bg-yellow-700 text-yellow-100',
    MINOR:    'bg-green-700 text-green-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[severity] ?? 'bg-gray-700 text-gray-100'}`}>
      {severity}
    </span>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  colorClass?: string
  sub?: string
}

function KpiCard({ label, value, colorClass = 'text-white', sub }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClimateRiskAnalytics() {
  const [dashboard, setDashboard] = useState<ClimateRiskDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient.getClimateRiskDashboard()
      .then(setDashboard)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        Loading climate risk data...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  // Top 10 assets by composite risk score
  const top10Assets = [...dashboard.assets]
    .sort((a, b) => b.composite_risk_score - a.composite_risk_score)
    .slice(0, 10)

  const barData = top10Assets.map(a => ({
    name: a.asset_name.length > 28 ? a.asset_name.slice(0, 28) + '…' : a.asset_name,
    score: a.composite_risk_score,
    category: a.risk_category,
  }))

  // KPI color logic
  const highCritPct = dashboard.total_assets_assessed > 0
    ? dashboard.high_critical_risk_assets / dashboard.total_assets_assessed
    : 0
  const highCritColor = highCritPct > 0.5 ? 'text-red-400' : 'text-white'

  const avgScoreColor =
    dashboard.avg_composite_risk_score >= 6 ? 'text-red-400' :
    dashboard.avg_composite_risk_score >= 4 ? 'text-amber-400' :
    'text-green-400'

  // Sorted events (most recent first)
  const sortedEvents = [...dashboard.events].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  )

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-full text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CloudLightning size={28} className="text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">
            Climate Risk &amp; Infrastructure Resilience Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Climate risk exposure of network assets — flood, fire, extreme heat &amp; storm vulnerability and adaptation investment
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Assets Assessed"
          value={dashboard.total_assets_assessed.toString()}
          sub="Network infrastructure assets"
        />
        <KpiCard
          label="High / Critical Risk Assets"
          value={`${dashboard.high_critical_risk_assets} / ${dashboard.total_assets_assessed}`}
          colorClass={highCritColor}
          sub={`${(highCritPct * 100).toFixed(0)}% of portfolio`}
        />
        <KpiCard
          label="Adaptation CAPEX Required"
          value={`$${dashboard.total_adaptation_capex_m_aud.toFixed(1)}M`}
          sub="AUD — total estimated spend"
        />
        <KpiCard
          label="Avg Composite Risk Score"
          value={dashboard.avg_composite_risk_score.toFixed(2)}
          colorClass={avgScoreColor}
          sub="0–10 scale across all assets"
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          label="Climate Events (Last 5 Years)"
          value={dashboard.events_last_5yr.toString()}
          sub="Flood, bushfire, heatwave, storm, cyclone"
        />
        <KpiCard
          label="Total Event Restoration Cost"
          value={`$${dashboard.total_event_restoration_cost_m_aud.toFixed(1)}M`}
          sub="AUD — network restoration spend"
        />
      </div>

      {/* Top 10 Assets — Composite Risk Bar Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Top 10 Assets by Composite Risk Score
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={barData}
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
              width={220}
              tick={{ fill: '#d1d5db', fontSize: 11 }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(val: number) => [val.toFixed(2), 'Risk Score']}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {barData.map((entry, idx) => (
                <Cell key={idx} fill={riskColor(entry.category)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-red-500" /> CRITICAL</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-orange-500" /> HIGH</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-yellow-500" /> MODERATE</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-green-500" /> LOW</span>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Network Asset Risk Assessment ({dashboard.assets.length} assets)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-3 font-medium">Asset Name</th>
                <th className="text-left py-2 pr-3 font-medium">Owner</th>
                <th className="text-left py-2 pr-3 font-medium">State</th>
                <th className="text-left py-2 pr-3 font-medium">Type</th>
                <th className="text-right py-2 pr-3 font-medium">Age (yr)</th>
                <th className="text-right py-2 pr-3 font-medium">Flood</th>
                <th className="text-right py-2 pr-3 font-medium">Bushfire</th>
                <th className="text-right py-2 pr-3 font-medium">Heat</th>
                <th className="text-right py-2 pr-3 font-medium">Composite</th>
                <th className="text-left py-2 pr-3 font-medium">Risk</th>
                <th className="text-right py-2 pr-3 font-medium">Customers at Risk</th>
                <th className="text-right py-2 pr-3 font-medium">Adapt. CAPEX ($M)</th>
                <th className="text-left py-2 font-medium">Adaptation Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.assets.map((asset: NetworkAssetRiskRecord) => (
                <tr key={asset.asset_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 text-gray-200 font-medium whitespace-nowrap">{asset.asset_name}</td>
                  <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{asset.owner}</td>
                  <td className="py-2 pr-3 text-gray-400">{asset.state}</td>
                  <td className="py-2 pr-3">{assetTypeBadge(asset.asset_type)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{asset.age_years}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{asset.flood_risk_score.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{asset.bushfire_risk_score.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{asset.extreme_heat_risk_score.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-gray-100">{asset.composite_risk_score.toFixed(1)}</td>
                  <td className="py-2 pr-3">{riskBadge(asset.risk_category)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{asset.customers_at_risk.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">${asset.adaptation_cost_m_aud.toFixed(1)}</td>
                  <td className="py-2">{adaptationBadge(asset.adaptation_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Historical Climate Events ({dashboard.events.length} events)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-3 font-medium">Date</th>
                <th className="text-left py-2 pr-3 font-medium">Type</th>
                <th className="text-left py-2 pr-3 font-medium">State</th>
                <th className="text-left py-2 pr-3 font-medium">Severity</th>
                <th className="text-right py-2 pr-3 font-medium">Customers Affected</th>
                <th className="text-right py-2 pr-3 font-medium">Outage (hrs)</th>
                <th className="text-right py-2 pr-3 font-medium">Restoration Cost ($M)</th>
                <th className="text-left py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((evt: ClimateEventRecord) => (
                <tr key={evt.event_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{evt.event_date}</td>
                  <td className="py-2 pr-3">{eventTypeBadge(evt.event_type)}</td>
                  <td className="py-2 pr-3 text-gray-400">{evt.state}</td>
                  <td className="py-2 pr-3">{severityBadge(evt.severity)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{evt.customers_affected.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{evt.outage_duration_hrs.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">${evt.restoration_cost_m_aud.toFixed(1)}</td>
                  <td className="py-2 text-gray-400">
                    {evt.network_damage_description.length > 60
                      ? evt.network_damage_description.slice(0, 60) + '…'
                      : evt.network_damage_description}
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
