import { useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  Activity,
  DollarSign,
  TrendingUp,
  Zap,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
} from 'recharts'
import { api, IFADashboard, IFAInterconnectorRecord, IFACapacityUpgradeRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Color palette per interconnector
// ---------------------------------------------------------------------------
const IC_COLORS: Record<string, string> = {
  QNI:       '#3b82f6', // blue
  'VIC-NSW': '#22c55e', // green
  HEYWOOD:   '#f59e0b', // amber
  MURRAYLINK:'#14b8a6', // teal
  BASSLINK:  '#a855f7', // purple
  PEC:       '#06b6d4', // cyan
  HUMELINK:  '#f97316', // orange
  MARINUS:   '#ec4899', // pink
}

// ---------------------------------------------------------------------------
// Helper badges
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPERATIONAL:       'bg-emerald-900 text-emerald-300 border border-emerald-700',
    PLANNED:           'bg-blue-900 text-blue-300 border border-blue-700',
    UNDER_CONSTRUCTION:'bg-amber-900 text-amber-300 border border-amber-700',
    PROPOSED:          'bg-gray-700 text-gray-300 border border-gray-600',
  }
  const cls = map[status] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function IcTypeBadge({ type }: { type: string }) {
  const cls =
    type === 'HVDC'
      ? 'bg-purple-900 text-purple-300 border border-purple-700'
      : 'bg-blue-900 text-blue-300 border border-blue-700'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {type}
    </span>
  )
}

function UpgradeTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    NEW_BUILD:           'bg-green-900 text-green-300 border border-green-700',
    CAPACITY_UPGRADE:    'bg-blue-900 text-blue-300 border border-blue-700',
    SERIES_COMPENSATION: 'bg-amber-900 text-amber-300 border border-amber-700',
  }
  const cls = map[type] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  const label = type.replace(/_/g, ' ')
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  unit: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">
          {value}
          <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function InterconnectorFlowAnalytics() {
  const [data, setData] = useState<IFADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getIFADashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading interconnector data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'Unknown error'}
      </div>
    )
  }

  // ---- Flow chart data: group by month, sum per interconnector ----
  const months = ['2024-01', '2024-02', '2024-03', '2024-04']
  const icIds = [...new Set(data.flow_records.map((r) => r.interconnector_id))]

  const flowChartData = months.map((month) => {
    const row: Record<string, string | number> = { month }
    icIds.forEach((ic) => {
      const rec = data.flow_records.find(
        (r) => r.month === month && r.interconnector_id === ic
      )
      row[ic] = rec ? Math.round(rec.avg_flow_mw) : 0
    })
    // average price diff across all ICs for this month
    const monthRecs = data.flow_records.filter((r) => r.month === month)
    row['price_diff'] = monthRecs.length
      ? Math.round(
          monthRecs.reduce((s, r) => s + r.avg_price_diff_aud_mwh, 0) /
            monthRecs.length
        )
      : 0
    return row
  })

  // ---- Binding frequency chart: per interconnector ----
  const bindingChartData = icIds
    .map((ic) => {
      const recs = data.flow_records.filter((r) => r.interconnector_id === ic)
      const avgImport =
        recs.length > 0
          ? recs.reduce((s, r) => s + r.import_binding_pct, 0) / recs.length
          : 0
      const avgExport =
        recs.length > 0
          ? recs.reduce((s, r) => s + r.export_binding_pct, 0) / recs.length
          : 0
      return {
        ic,
        import_pct: Math.round(avgImport * 10) / 10,
        export_pct: Math.round(avgExport * 10) / 10,
        total: Math.round((avgImport + avgExport) * 10) / 10,
      }
    })
    .sort((a, b) => b.total - a.total)

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-blue-900">
          <ArrowLeftRight size={28} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            NEM Interconnector Flow &amp; Limit Binding Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Detailed analysis of power flows on QNI, VIC-NSW, Heywood, Murraylink and
            Basslink — including binding frequency, congestion rents, and capacity
            upgrade projects such as Project EnergyConnect and HumeLink.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total IC Capacity (Operational)"
          value={data.total_ic_capacity_mw.toLocaleString()}
          unit="MW"
          icon={Zap}
          color="bg-blue-700"
        />
        <KpiCard
          label="Avg Binding Frequency"
          value={data.avg_binding_pct.toFixed(1)}
          unit="%"
          icon={Activity}
          color="bg-amber-700"
        />
        <KpiCard
          label="Total Congestion Rent"
          value={`$${data.total_congestion_rent_m_aud.toFixed(0)}`}
          unit="M AUD"
          icon={DollarSign}
          color="bg-red-700"
        />
        <KpiCard
          label="Planned Capacity Increase"
          value={data.planned_capacity_increase_mw.toLocaleString()}
          unit="MW"
          icon={TrendingUp}
          color="bg-emerald-700"
        />
      </div>

      {/* Flow Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold text-white mb-4">
          Monthly Average Flow by Interconnector (MW) + Avg Price Differential ($/MWh)
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={flowChartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Avg Flow (MW)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#fbbf24', fontSize: 12 }}
              label={{ value: 'Price Diff ($/MWh)', angle: 90, position: 'insideRight', fill: '#fbbf24', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <ReferenceLine yAxisId="left" y={0} stroke="#6b7280" />
            {icIds.map((ic) => (
              <Bar
                key={ic}
                yAxisId="left"
                dataKey={ic}
                name={ic}
                fill={IC_COLORS[ic] ?? '#6b7280'}
                opacity={0.85}
                maxBarSize={18}
              />
            ))}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="price_diff"
              name="Avg Price Diff"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={{ r: 4, fill: '#fbbf24' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Binding Frequency Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold text-white mb-4">
          Binding Frequency by Interconnector — Import &amp; Export (%)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            layout="vertical"
            data={bindingChartData}
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="ic"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              width={90}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => `${v}%`}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="import_pct" name="Import Binding %" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            <Bar dataKey="export_pct" name="Export Binding %" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interconnectors Status Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold text-white mb-4">
          NEM Interconnectors — Status &amp; Technical Details
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {[
                  'Interconnector',
                  'Route',
                  'Type',
                  'Capacity (MW)',
                  'Status',
                  'Commission',
                  'Voltage (kV)',
                  'Length (km)',
                  'Operator',
                ].map((h) => (
                  <th
                    key={h}
                    className="pb-2 pr-4 text-left text-xs font-medium text-gray-400 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.interconnectors.map((ic: IFAInterconnectorRecord) => (
                <tr
                  key={ic.interconnector_id}
                  className="border-b border-gray-700 hover:bg-gray-750"
                >
                  <td className="py-2 pr-4 font-medium text-white whitespace-nowrap">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                      style={{ backgroundColor: IC_COLORS[ic.interconnector_id] ?? '#6b7280' }}
                    />
                    {ic.interconnector_name}
                  </td>
                  <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">
                    {ic.from_region} &rarr; {ic.to_region}
                  </td>
                  <td className="py-2 pr-4">
                    <IcTypeBadge type={ic.ic_type} />
                  </td>
                  <td className="py-2 pr-4 text-gray-200 font-mono">
                    {ic.current_capacity_mw.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={ic.status} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">
                    {ic.commission_year ?? '—'}
                  </td>
                  <td className="py-2 pr-4 text-gray-300 font-mono">
                    {ic.voltage_kv}
                  </td>
                  <td className="py-2 pr-4 text-gray-300 font-mono">
                    {ic.length_km}
                  </td>
                  <td className="py-2 text-gray-300 whitespace-nowrap">
                    {ic.operator}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capacity Upgrade Projects Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-base font-semibold text-white mb-4">
          Capacity Upgrade Projects
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {[
                  'Project',
                  'Interconnector',
                  'Type',
                  'Additional Capacity (MW)',
                  'CAPEX ($M)',
                  'BCR',
                  'Regulated',
                  'Status',
                  'Completion',
                  'Consumer Benefit ($M/yr)',
                ].map((h) => (
                  <th
                    key={h}
                    className="pb-2 pr-4 text-left text-xs font-medium text-gray-400 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.capacity_upgrades.map((u: IFACapacityUpgradeRecord) => (
                <tr
                  key={u.project_id}
                  className="border-b border-gray-700 hover:bg-gray-750"
                >
                  <td className="py-2 pr-4 font-medium text-white whitespace-nowrap">
                    {u.project_name}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: IC_COLORS[u.interconnector_id] ?? '#6b7280' }}
                    />
                    <span className="text-gray-300">{u.interconnector_id}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <UpgradeTypeBadge type={u.upgrade_type} />
                  </td>
                  <td className="py-2 pr-4 text-gray-200 font-mono">
                    +{u.additional_capacity_mw.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-gray-200 font-mono">
                    ${u.estimated_capex_m_aud.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`font-bold ${
                        u.benefit_cost_ratio >= 2.5
                          ? 'text-emerald-400'
                          : u.benefit_cost_ratio >= 1.5
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {u.benefit_cost_ratio.toFixed(1)}x
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    {u.regulated_asset ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-emerald-900 text-emerald-300 border border-emerald-700">
                        Regulated
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400 border border-gray-600">
                        Market
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">
                    {u.completion_year ?? '—'}
                  </td>
                  <td className="py-2 text-emerald-400 font-mono font-semibold">
                    ${u.annual_consumer_benefit_m_aud.toFixed(0)}M
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
