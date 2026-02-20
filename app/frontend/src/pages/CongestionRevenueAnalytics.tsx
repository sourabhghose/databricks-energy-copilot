import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { Network, DollarSign, TrendingUp, Activity } from 'lucide-react'
import { getCongestionRevenueDashboard } from '../api/client'
import type { CongestionRevenueDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#10b981',
  SA1:  '#ef4444',
  TAS1: '#8b5cf6',
}

const INTERCONNECTOR_COLOURS: Record<string, string> = {
  'VIC1-NSW1': '#3b82f6',
  'NSW1-QLD1': '#f59e0b',
  'SA1-VIC1':  '#10b981',
  'TAS1-VIC1': '#8b5cf6',
}

const DIRECTION_BADGE: Record<string, string> = {
  FORWARD: 'bg-blue-900 text-blue-300',
  REVERSE: 'bg-amber-900 text-amber-300',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  colour: string
}

function KpiCard({ icon, label, value, sub, colour }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <div className={`flex items-center gap-2 text-sm font-medium mb-3 ${colour}`}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CongestionRevenueAnalytics() {
  const [data, setData] = useState<CongestionRevenueDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCongestionRevenueDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading congestion revenue data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Failed to load data: {error}</div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Derived KPIs
  // -------------------------------------------------------------------------
  const totalSraValue = data.sra_contracts.reduce(
    (s, c) => s + c.total_value_m_aud,
    0,
  )

  const rentByInterconnector = data.congestion_rents.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.interconnector] = (acc[r.interconnector] ?? 0) + r.total_rent_m_aud
      return acc
    },
    {},
  )
  const highestRentInterconnector = Object.entries(rentByInterconnector).sort(
    (a, b) => b[1] - a[1],
  )[0]

  const totalRetained = data.congestion_rents.reduce(
    (s, r) => s + r.retained_m_aud,
    0,
  )

  const bestBcrRecord = [...data.interconnector_economics].sort(
    (a, b) => b.benefit_cost_ratio - a.benefit_cost_ratio,
  )[0]

  // -------------------------------------------------------------------------
  // Chart data: stacked bar — allocated vs retained by interconnector (Q1-2025)
  // -------------------------------------------------------------------------
  const rentChartData = Object.entries(
    data.congestion_rents.reduce<
      Record<string, { interconnector: string; allocated: number; retained: number }>
    >((acc, r) => {
      if (!acc[r.interconnector]) {
        acc[r.interconnector] = { interconnector: r.interconnector, allocated: 0, retained: 0 }
      }
      acc[r.interconnector].allocated += r.sra_allocated_m_aud
      acc[r.interconnector].retained  += r.retained_m_aud
      return acc
    }, {}),
  ).map(([, v]) => v)

  // -------------------------------------------------------------------------
  // Chart data: nodal price scatter — x=congestion, y=avg_lmp, size=fixed
  // -------------------------------------------------------------------------
  const scatterData = data.nodal_prices.map(n => ({
    x:      n.congestion_component_aud,
    y:      n.avg_lmp_aud_mwh,
    z:      100,
    region: n.region,
    name:   n.node_name,
  }))

  // -------------------------------------------------------------------------
  // Chart data: BCR bar chart — latest year per interconnector
  // -------------------------------------------------------------------------
  const bcrData = Object.values(
    data.interconnector_economics.reduce<
      Record<string, { interconnector: string; benefit_cost_ratio: number; year: number }>
    >((acc, r) => {
      if (!acc[r.interconnector] || r.year > acc[r.interconnector].year) {
        acc[r.interconnector] = {
          interconnector:     r.interconnector,
          benefit_cost_ratio: r.benefit_cost_ratio,
          year:               r.year,
        }
      }
      return acc
    }, {}),
  ).sort((a, b) => b.benefit_cost_ratio - a.benefit_cost_ratio)

  // -------------------------------------------------------------------------
  // Custom tooltips
  // -------------------------------------------------------------------------
  const RentTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-gray-900 border border-gray-600 rounded p-3 text-xs text-gray-200">
        <div className="font-semibold mb-1">{d.interconnector}</div>
        <div>SRA Allocated: <span className="text-blue-400">A${d.allocated.toFixed(1)}M</span></div>
        <div>Retained:       <span className="text-amber-400">A${d.retained.toFixed(1)}M</span></div>
        <div>Total:           <span className="text-white">A${(d.allocated + d.retained).toFixed(1)}M</span></div>
      </div>
    )
  }

  const ScatterTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-gray-900 border border-gray-600 rounded p-3 text-xs text-gray-200">
        <div className="font-semibold mb-1">{d.name}</div>
        <div>Region:            <span className="text-purple-300">{d.region}</span></div>
        <div>Avg LMP:           <span className="text-blue-400">A${d.y.toFixed(1)}/MWh</span></div>
        <div>Congestion Comp:   <span className="text-amber-400">A${d.x.toFixed(1)}/MWh</span></div>
      </div>
    )
  }

  const BcrTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-gray-900 border border-gray-600 rounded p-3 text-xs text-gray-200">
        <div className="font-semibold mb-1">{d.interconnector}</div>
        <div>BCR ({d.year}): <span className="text-green-400">{d.benefit_cost_ratio.toFixed(2)}x</span></div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Network className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Network Congestion Revenue &amp; SRA Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Inter-regional Settlement Residue Auction contracts, congestion rent distribution,
            and nodal pricing implications across the NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Total SRA Contract Value"
          value={`A$${totalSraValue.toFixed(1)}M`}
          sub="All interconnectors, all quarters"
          colour="text-blue-400"
        />
        <KpiCard
          icon={<Activity className="w-4 h-4" />}
          label="Highest Congestion Rent"
          value={highestRentInterconnector?.[0] ?? '—'}
          sub={`A$${highestRentInterconnector?.[1].toFixed(1)}M total congestion rent`}
          colour="text-amber-400"
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Total Retained Congestion Rent"
          value={`A$${totalRetained.toFixed(1)}M`}
          sub="Retained by TNSPs across all quarters"
          colour="text-red-400"
        />
        <KpiCard
          icon={<Network className="w-4 h-4" />}
          label="Best Benefit–Cost Ratio"
          value={bestBcrRecord ? `${bestBcrRecord.interconnector} — ${bestBcrRecord.benefit_cost_ratio.toFixed(2)}x` : '—'}
          sub={`Year ${bestBcrRecord?.year ?? ''}`}
          colour="text-green-400"
        />
      </div>

      {/* SRA Contract Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">SRA Contract Register</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4">Contract ID</th>
                <th className="pb-2 pr-4">Quarter</th>
                <th className="pb-2 pr-4">Interconnector</th>
                <th className="pb-2 pr-4">Direction</th>
                <th className="pb-2 pr-4 text-right">MW</th>
                <th className="pb-2 pr-4 text-right">Clearing Price</th>
                <th className="pb-2 pr-4 text-right">Total Value</th>
                <th className="pb-2 pr-4">Holder</th>
                <th className="pb-2 text-right">Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {data.sra_contracts.map(c => (
                <tr key={c.contract_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-gray-300 font-mono text-xs">{c.contract_id}</td>
                  <td className="py-2 pr-4 text-gray-300">{c.quarter}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: (INTERCONNECTOR_COLOURS[c.interconnector] ?? '#6b7280') + '33',
                        color:            INTERCONNECTOR_COLOURS[c.interconnector] ?? '#9ca3af',
                      }}
                    >
                      {c.interconnector}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${DIRECTION_BADGE[c.direction] ?? ''}`}>
                      {c.direction}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-200">{c.mw_contracted.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right text-blue-300">
                    A${c.clearing_price_aud_mwh.toFixed(2)}/MWh
                  </td>
                  <td className="py-2 pr-4 text-right text-green-300 font-medium">
                    A${c.total_value_m_aud.toFixed(2)}M
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{c.holder}</td>
                  <td className="py-2 text-right">
                    <span
                      className={`font-medium ${
                        c.utilisation_pct >= 80
                          ? 'text-green-400'
                          : c.utilisation_pct >= 60
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {c.utilisation_pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Congestion Rent Stacked Bar */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
          <h2 className="text-lg font-semibold text-white mb-1">
            Congestion Rent Distribution by Interconnector
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Total across all quarters — SRA-allocated vs TNSP-retained (A$M)
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rentChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="interconnector"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `A$${v.toFixed(0)}M`}
              />
              <Tooltip content={<RentTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }}
              />
              <Bar dataKey="allocated" name="SRA Allocated" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="retained"  name="TNSP Retained" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Nodal Price Scatter */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
          <h2 className="text-lg font-semibold text-white mb-1">
            Nodal Price Analysis — Congestion vs LMP
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            X-axis: congestion component (A$/MWh) · Y-axis: average LMP (A$/MWh) · coloured by region
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="x"
                type="number"
                name="Congestion Component"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={false}
                label={{ value: 'Congestion (A$/MWh)', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 11 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                name="Avg LMP"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={[60, 180]}
                label={{ value: 'Avg LMP (A$/MWh)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
              />
              <ZAxis dataKey="z" range={[60, 60]} />
              <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="4 2" />
              <Tooltip content={<ScatterTooltip />} />
              {Object.entries(REGION_COLOURS).map(([region, colour]) => (
                <Scatter
                  key={region}
                  name={region}
                  data={scatterData.filter(d => d.region === region)}
                  fill={colour}
                  opacity={0.85}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interconnector BCR Bar Chart */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h2 className="text-lg font-semibold text-white mb-1">
          Interconnector Benefit–Cost Ratio (Latest Year)
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Net benefit as a multiple of allocated costs — BCR &gt; 1.0 indicates net positive economic value
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={bcrData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              domain={[0, 3]}
              tickFormatter={(v: number) => `${v.toFixed(1)}x`}
            />
            <YAxis
              dataKey="interconnector"
              type="category"
              width={110}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine x={1} stroke="#6b7280" strokeDasharray="4 2" label={{ value: 'BCR=1.0', fill: '#9ca3af', fontSize: 10 }} />
            <Tooltip content={<BcrTooltip />} />
            <Bar dataKey="benefit_cost_ratio" name="Benefit–Cost Ratio" radius={[0, 4, 4, 0]}>
              {bcrData.map(entry => (
                <Cell
                  key={entry.interconnector}
                  fill={INTERCONNECTOR_COLOURS[entry.interconnector] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-500 text-right">
        Data as at {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
        &nbsp;·&nbsp; Sprint 58a
      </div>
    </div>
  )
}
