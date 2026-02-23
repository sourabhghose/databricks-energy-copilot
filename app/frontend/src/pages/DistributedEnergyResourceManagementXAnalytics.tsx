import { useEffect, useState } from 'react'
import { Grid } from 'lucide-react'
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
} from 'recharts'
import {
  getDistributedEnergyResourceManagementXDashboard,
  DERMXDashboard,
  DERMXAsset,
  DERMXDispatch,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  Active:    '#22c55e',
  Pilot:     '#f59e0b',
  Enrolled:  '#3b82f6',
  Suspended: '#ef4444',
}

const PLATFORM_COLORS: Record<string, string> = {
  VPP:               '#6366f1',
  BYOD:              '#f59e0b',
  'Managed Charging':'#22c55e',
  'Smart Home':      '#ec4899',
}

const IMPACT_COLORS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#22c55e',
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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
// Chart 1 — DER asset controllable_mw by asset_type, coloured by status
// ---------------------------------------------------------------------------

function AssetControllableChart({ assets }: { assets: DERMXAsset[] }) {
  const data = assets.map(a => ({
    name: a.asset_type.length > 14 ? a.asset_type.slice(0, 14) + '…' : a.asset_type,
    fullName: a.asset_type,
    controllable_mw: a.controllable_mw,
    status: a.status,
    fill: STATUS_COLORS[a.status] ?? '#6b7280',
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        DER Asset Controllable Capacity (MW) by Asset Type
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number, _name: string, props: { payload?: { status?: string; fullName?: string } }) => [
              `${val.toFixed(2)} MW`,
              props?.payload?.fullName ?? '',
            ]}
          />
          <Bar dataKey="controllable_mw" name="Controllable MW" radius={[4,4,0,0]}
            isAnimationActive={false}
            fill="#3b82f6"
            label={false}
          >
            {data.map((entry, index) => (
              <rect key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(STATUS_COLORS).map(([st, col]) => (
          <span key={st} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col }} />
            {st}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Monthly dispatch revenue_k_aud trend for 5 key assets across 2024
// ---------------------------------------------------------------------------

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4']

function DispatchRevenueChart({ dispatch, assets }: { dispatch: DERMXDispatch[]; assets: DERMXAsset[] }) {
  // get the 5 unique asset IDs used in dispatch
  const assetIds = Array.from(new Set(dispatch.map(d => d.asset_id))).slice(0, 5)
  const assetNames: Record<string, string> = {}
  for (const a of assets) {
    assetNames[a.asset_id] = a.asset_name.length > 18 ? a.asset_name.slice(0, 18) + '…' : a.asset_name
  }

  const byMonth: Record<number, Record<string, number>> = {}
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = {}
    for (const aid of assetIds) byMonth[m][aid] = 0
  }
  for (const d of dispatch) {
    if (assetIds.includes(d.asset_id)) {
      byMonth[d.month][d.asset_id] = d.revenue_k_aud
    }
  }

  const data = MONTH_LABELS.map((label, idx) => {
    const row: Record<string, number | string> = { month: label }
    for (const aid of assetIds) row[aid] = byMonth[idx + 1][aid] ?? 0
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Monthly Dispatch Revenue (k AUD) — 5 Key Assets (2024)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'k AUD', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number) => [`${val.toFixed(1)} k AUD`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {assetIds.map((aid, idx) => (
            <Line
              key={aid}
              type="monotone"
              dataKey={aid}
              name={assetNames[aid] ?? aid}
              stroke={LINE_COLORS[idx % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Aggregator total_capacity_mw coloured by platform_type
// ---------------------------------------------------------------------------

function AggregatorCapacityChart({ aggregators }: { aggregators: DERMXDashboard['aggregators'] }) {
  const data = aggregators.map(a => ({
    name: a.aggregator_name.length > 14 ? a.aggregator_name.slice(0, 14) + '…' : a.aggregator_name,
    fullName: a.aggregator_name,
    total_capacity_mw: a.total_capacity_mw,
    platform_type: a.platform_type,
    fill: PLATFORM_COLORS[a.platform_type] ?? '#6b7280',
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Aggregator Total Capacity (MW) by Platform Type
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-40} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number, _name: string, props: { payload?: { fullName?: string; platform_type?: string } }) => [
              `${val.toFixed(2)} MW`,
              `${props?.payload?.fullName} (${props?.payload?.platform_type})`,
            ]}
          />
          <Bar dataKey="total_capacity_mw" name="Total Capacity MW" radius={[4,4,0,0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <rect key={`agg-cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(PLATFORM_COLORS).map(([pt, col]) => (
          <span key={pt} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col }} />
            {pt}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Stacked bar: regional der_controllable_mw vs network_deferral_benefit quarterly
// ---------------------------------------------------------------------------

function RegionalGridChart({ grid }: { grid: DERMXDashboard['grid'] }) {
  // Group by region+quarter label, sum controllable_mw and deferral
  const map: Record<string, { controllable: number; deferral: number }> = {}
  for (const g of grid) {
    const key = `${g.region} ${g.quarter}`
    if (!map[key]) map[key] = { controllable: 0, deferral: 0 }
    map[key].controllable += g.der_controllable_mw
    map[key].deferral += g.network_deferral_benefit_m_aud
  }
  const data = Object.entries(map).map(([key, vals]) => ({
    label: key,
    controllable_mw: Math.round(vals.controllable * 10) / 10,
    deferral_m_aud: Math.round(vals.deferral * 100) / 100,
  })).slice(0, 20) // cap for readability

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Regional DER Controllable MW vs Network Deferral Benefit ($M) by Quarter
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 70 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-45} textAnchor="end" />
          <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$M', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="controllable_mw" name="Controllable MW" fill="#3b82f6" radius={[4,4,0,0]} isAnimationActive={false} />
          <Bar yAxisId="right" dataKey="deferral_m_aud" name="Network Deferral $M" fill="#22c55e" radius={[4,4,0,0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Regulatory framework count by category coloured by impact
// ---------------------------------------------------------------------------

function RegulatoryChart({ regulatory }: { regulatory: DERMXDashboard['regulatory'] }) {
  // Group by category and impact
  const map: Record<string, { High: number; Medium: number; Low: number }> = {}
  for (const r of regulatory) {
    if (!map[r.category]) map[r.category] = { High: 0, Medium: 0, Low: 0 }
    map[r.category][r.impact as 'High' | 'Medium' | 'Low'] =
      (map[r.category][r.impact as 'High' | 'Medium' | 'Low'] ?? 0) + 1
  }
  const data = Object.entries(map).map(([cat, counts]) => ({
    category: cat.length > 16 ? cat.slice(0, 16) + '…' : cat,
    fullCategory: cat,
    High: counts.High,
    Medium: counts.Medium,
    Low: counts.Low,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Regulatory Framework Count by Category &amp; Impact Level
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar dataKey="High" name="High Impact" stackId="a" fill={IMPACT_COLORS.High} isAnimationActive={false} />
          <Bar dataKey="Medium" name="Medium Impact" stackId="a" fill={IMPACT_COLORS.Medium} isAnimationActive={false} />
          <Bar dataKey="Low" name="Low Impact" stackId="a" fill={IMPACT_COLORS.Low} radius={[4,4,0,0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DistributedEnergyResourceManagementXAnalytics() {
  const [data, setData] = useState<DERMXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDistributedEnergyResourceManagementXDashboard()
      .then(setData)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-400 animate-pulse">Loading DERM Analytics…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-red-400">{error ?? 'No data available.'}</span>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-indigo-600">
          <Grid className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            DERM Analytics — Distributed Energy Resource Management
          </h1>
          <p className="text-sm text-gray-400">
            DERMS / CER management in the National Electricity Market (NEM)
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Enrolled Customers"
          value={summary.total_enrolled_customers.toLocaleString()}
          sub="across all DER assets"
        />
        <KpiCard
          label="Total Controllable MW"
          value={`${summary.total_controllable_mw.toFixed(1)} MW`}
          sub="dispatchable capacity"
        />
        <KpiCard
          label="Avg Dispatch Success"
          value={`${summary.avg_dispatch_success_rate_pct.toFixed(1)}%`}
          sub="response success rate"
        />
        <KpiCard
          label="Network Deferral Benefit"
          value={`$${summary.total_network_deferral_m_aud.toFixed(1)}M`}
          sub="AUD infrastructure savings"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AssetControllableChart assets={data.assets} />
        <DispatchRevenueChart dispatch={data.dispatch} assets={data.assets} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AggregatorCapacityChart aggregators={data.aggregators} />
        <RegionalGridChart grid={data.grid} />
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <RegulatoryChart regulatory={data.regulatory} />
      </div>

      {/* Summary footer */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Platform Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total Aggregators</span>
            <p className="text-white font-semibold">{summary.total_aggregators}</p>
          </div>
          <div>
            <span className="text-gray-500">Best Asset Type</span>
            <p className="text-white font-semibold">{summary.best_performing_asset_type}</p>
          </div>
          <div>
            <span className="text-gray-500">Total DER Revenue</span>
            <p className="text-white font-semibold">${summary.total_der_revenue_m_aud.toFixed(2)}M AUD</p>
          </div>
          <div>
            <span className="text-gray-500">Controllable Capacity</span>
            <p className="text-white font-semibold">{summary.total_controllable_mw.toFixed(1)} MW</p>
          </div>
        </div>
      </div>
    </div>
  )
}
