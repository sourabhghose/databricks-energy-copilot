import { useEffect, useState } from 'react'
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
import { Gavel } from 'lucide-react'
import {
  getNemSettlementResidueAuctionDashboard,
  NSRADashboard,
} from '../api/client'

export default function NemSettlementResidueAuctionAnalytics() {
  const [data, setData] = useState<NSRADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNemSettlementResidueAuctionDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        Loading Settlement Residue Auction data...
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )

  const { summary, auctions, sra_holders, settlement_residue_flows, market_activity, interconnector_metrics } = data
  const interconnectors = ['VIC1-NSW1', 'SA1-VIC1', 'NSW1-QLD1', 'VIC1-TAS1']
  const years = [2021, 2022, 2023, 2024]
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444']

  // Chart 1: total_revenue_m by interconnector x year (grouped bars)
  const revenueByYearData = years.map((yr) => {
    const row: Record<string, number | string> = { year: String(yr) }
    interconnectors.forEach((iid) => {
      row[iid] = parseFloat(
        auctions
          .filter((a) => a.auction_year === yr && a.interconnector_id === iid)
          .reduce((s, a) => s + a.total_revenue_m, 0)
          .toFixed(2)
      )
    })
    return row
  })

  // Chart 2: avg_clearing_price by quarter in 2024
  const clearingPrice2024Data = [1, 2, 3, 4].map((q) => {
    const relevant = auctions.filter((a) => a.auction_year === 2024 && a.auction_quarter === q)
    const avg = relevant.length
      ? parseFloat((relevant.reduce((s, a) => s + a.clearing_price_aud, 0) / relevant.length).toFixed(0))
      : 0
    return { quarter: `Q${q}`, avg_clearing_price: avg }
  })

  // Chart 3: stacked bar — SR flows paid vs retained by TNSP per interconnector (2024)
  const srFlowData = interconnectors.map((iid) => {
    const flows = settlement_residue_flows.filter((f) => f.interconnector_id === iid && f.year === 2024)
    return {
      interconnector: iid,
      paid: parseFloat(flows.reduce((s, f) => s + f.paid_to_sra_holders_m, 0).toFixed(2)),
      retained: parseFloat(flows.reduce((s, f) => s + f.retained_by_tnsp_m, 0).toFixed(2)),
    }
  })

  // Chart 4: avg profit/loss per holder (2024)
  const holderPLData = Array.from(
    sra_holders
      .filter((h) => h.year === 2024)
      .reduce((map, h) => {
        const entry = map.get(h.holder_name) ?? { sum: 0, count: 0 }
        entry.sum += h.profit_loss_aud
        entry.count += 1
        map.set(h.holder_name, entry)
        return map
      }, new Map<string, { sum: number; count: number }>())
      .entries()
  ).map(([name, { sum, count }]) => ({
    holder: name.length > 12 ? name.slice(0, 12) + '…' : name,
    avg_profit_loss: parseFloat((sum / count).toFixed(2)),
  }))

  // Chart 5: market_activity total_revenue_m by year-quarter
  const marketTrendData = market_activity.map((ma) => ({
    period: `${ma.year} Q${ma.quarter}`,
    total_revenue_m: ma.total_revenue_m,
  }))

  return (
    <div className="p-6 space-y-8 bg-gray-950 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Gavel className="text-indigo-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            NEM Settlement Residue Auction Analytics
          </h1>
          <p className="text-sm text-gray-400">
            SRA auction results, SRA holder positions, settlement residue flows and interconnector performance
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total SR Revenue FY</p>
          <p className="text-2xl font-bold text-indigo-400 mt-1">
            ${summary.total_sr_revenue_fy_m.toFixed(1)}M
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Clearing Price</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            ${summary.avg_clearing_price.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Most Valuable Interconnector</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {summary.most_valuable_interconnector}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Participants</p>
          <p className="text-2xl font-bold text-sky-400 mt-1">
            {summary.total_participants}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Oversubscription</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">
            {summary.avg_oversubscription_ratio.toFixed(2)}x
          </p>
        </div>
      </div>

      {/* Chart 1: Revenue by Interconnector x Year */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Auction Revenue by Interconnector and Year ($M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={revenueByYearData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {interconnectors.map((iid, idx) => (
              <Bar key={iid} dataKey={iid} name={iid} fill={COLORS[idx]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Avg Clearing Price by Quarter 2024 */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Average Clearing Price by Quarter — 2024 ($/unit)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={clearingPrice2024Data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            <Line
              type="monotone"
              dataKey="avg_clearing_price"
              name="Avg Clearing Price ($)"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Stacked SR flows by interconnector 2024 */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Settlement Residue Distribution by Interconnector — 2024 ($M)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={srFlowData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="interconnector" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            <Bar dataKey="paid" name="Paid to SRA Holders ($M)" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="retained" name="Retained by TNSP ($M)" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Avg profit/loss per holder 2024 */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Average Profit / Loss per SRA Holder — 2024 ($K)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={holderPLData} margin={{ top: 5, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="holder" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            <Bar dataKey="avg_profit_loss" name="Avg P&L ($)" fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Market activity revenue trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Market Activity — Total Revenue by Year-Quarter ($M)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={marketTrendData} margin={{ top: 5, right: 20, bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="period"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={3}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            <Line
              type="monotone"
              dataKey="total_revenue_m"
              name="Total Revenue ($M)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 3 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">SR Revenue FY24</dt>
            <dd className="mt-1 text-lg font-semibold text-white">
              ${summary.total_sr_revenue_fy_m.toFixed(2)}M
            </dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Avg Clearing Price</dt>
            <dd className="mt-1 text-lg font-semibold text-white">
              ${summary.avg_clearing_price.toLocaleString()}
            </dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Top Interconnector</dt>
            <dd className="mt-1 text-lg font-semibold text-white">
              {summary.most_valuable_interconnector}
            </dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Total Participants</dt>
            <dd className="mt-1 text-lg font-semibold text-white">
              {summary.total_participants}
            </dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Avg Oversubscription</dt>
            <dd className="mt-1 text-lg font-semibold text-white">
              {summary.avg_oversubscription_ratio.toFixed(2)}x
            </dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Total Auctions</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{auctions.length}</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Total SRA Holders</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{sra_holders.length}</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">SR Flow Records</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{settlement_residue_flows.length}</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Market Activity Records</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{market_activity.length}</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Interconnector Metrics</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{interconnector_metrics.length}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
