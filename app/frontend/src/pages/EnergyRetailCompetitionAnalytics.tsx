import { useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  getEnergyRetailCompetitionDashboard,
  ERCODashboard,
  ERCOOfferRecord,
  ERCORetailerMetricRecord,
  ERCOPriceComparisonRecord,
  ERCOSwitchingIncentiveRecord,
  ERCOComplaintCategoryRecord,
} from '../api/client'

const REGION_COLORS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#34d399',
  VIC1: '#a78bfa',
  SA1:  '#fbbf24',
  TAS1: '#f97316',
}

const TARIFF_COLORS: Record<string, string> = {
  FLAT:        'bg-blue-900 text-blue-300 border border-blue-700',
  TIME_OF_USE: 'bg-purple-900 text-purple-300 border border-purple-700',
  DEMAND:      'bg-orange-900 text-orange-300 border border-orange-700',
  FLEXIBLE:    'bg-green-900 text-green-300 border border-green-700',
}

const INCENTIVE_COLORS: Record<string, string> = {
  SIGN_ON_CREDIT: 'bg-emerald-900 text-emerald-300 border border-emerald-700',
  DISCOUNT:       'bg-blue-900 text-blue-300 border border-blue-700',
  GIFT_CARD:      'bg-pink-900 text-pink-300 border border-pink-700',
  GREEN_POWER:    'bg-green-900 text-green-300 border border-green-700',
  SMART_HOME:     'bg-indigo-900 text-indigo-300 border border-indigo-700',
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

function TariffBadge({ tariff }: { tariff: string }) {
  const cls = TARIFF_COLORS[tariff] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {tariff.replace('_', ' ')}
    </span>
  )
}

function IncentiveBadge({ type }: { type: string }) {
  const cls = INCENTIVE_COLORS[type] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}

function YoYArrow({ val }: { val: number }) {
  if (val > 5)  return <span className="text-red-400 font-bold">+{val.toFixed(1)}% ↑</span>
  if (val < -5) return <span className="text-green-400 font-bold">{val.toFixed(1)}% ↓</span>
  return <span className="text-gray-400">{val > 0 ? '+' : ''}{val.toFixed(1)}%</span>
}

// Aggregate price comparisons by region (latest 2024 data only) for bar chart
function aggregatePriceByRegion(comparisons: ERCOPriceComparisonRecord[]) {
  const latest = comparisons.filter(c => c.year === 2024)
  const map: Record<string, { cheapest: number[]; median: number[]; expensive: number[]; reference: number[] }> = {}
  for (const c of latest) {
    if (!map[c.region]) map[c.region] = { cheapest: [], median: [], expensive: [], reference: [] }
    map[c.region].cheapest.push(c.cheapest_offer_aud_yr)
    map[c.region].median.push(c.median_offer_aud_yr)
    map[c.region].expensive.push(c.expensive_offer_aud_yr)
    map[c.region].reference.push(c.reference_price_aud_yr)
  }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  return Object.entries(map).map(([region, vals]) => ({
    region,
    Cheapest: avg(vals.cheapest),
    Median: avg(vals.median),
    Expensive: avg(vals.expensive),
    Reference: avg(vals.reference),
  }))
}

// Prepare scatter data: NPS vs complaints, sized by market share (averaged across regions)
function prepareRetailerScatter(metrics: ERCORetailerMetricRecord[]) {
  const map: Record<string, { nps: number[]; complaints: number[]; share: number[] }> = {}
  for (const m of metrics) {
    if (!map[m.retailer]) map[m.retailer] = { nps: [], complaints: [], share: [] }
    map[m.retailer].nps.push(m.nps_score)
    map[m.retailer].complaints.push(m.complaints_per_1000)
    map[m.retailer].share.push(m.market_share_pct)
  }
  return Object.entries(map).map(([retailer, vals]) => {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    return {
      retailer,
      nps: parseFloat(avg(vals.nps).toFixed(1)),
      complaints: parseFloat(avg(vals.complaints).toFixed(1)),
      share: parseFloat(avg(vals.share).toFixed(1)),
    }
  })
}

export default function EnergyRetailCompetitionAnalytics() {
  const [data, setData] = useState<ERCODashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyRetailCompetitionDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400 text-sm">
        Loading Energy Retail Competition data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400 text-sm">
        Failed to load data: {error}
      </div>
    )
  }

  const { summary, offers, retailer_metrics, price_comparisons, switching_incentives, complaint_categories } = data

  const priceBarData = aggregatePriceByRegion(price_comparisons)
  const scatterData = prepareRetailerScatter(retailer_metrics)

  return (
    <div className="p-6 bg-gray-900 min-h-full text-white space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShoppingCart className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Energy Retail Competition Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Offer comparison, retailer performance, switching incentives and complaints — Australian NEM
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Offers"
          value={String(summary.total_offers as number)}
          sub={`${summary.total_retailers as number} active retailers`}
          accent="text-emerald-400"
        />
        <KpiCard
          label="Avg Savings vs Reference"
          value={`${summary.avg_savings_vs_reference_pct as number}%`}
          sub="below DMO/VDO reference price"
          accent="text-green-400"
        />
        <KpiCard
          label="Most Complained Retailer"
          value={summary.most_complained_retailer as string}
          sub="highest complaints per 1,000"
          accent="text-red-400"
        />
        <KpiCard
          label="Offers Below Reference"
          value={`${summary.offers_below_reference_pct as number}%`}
          sub={`Cheapest region: ${summary.cheapest_region as string}`}
          accent="text-blue-400"
        />
      </div>

      {/* Charts Row: Price Comparison Bar + Retailer Scatter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price Comparison Bar Chart */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Annual Bill Comparison by Region (2024)</h2>
          <p className="text-xs text-gray-500 mb-3">Cheapest / Median / Expensive offer vs DMO/VDO reference price (AUD/yr)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={priceBarData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $" tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="Cheapest"  fill="#34d399" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Median"    fill="#60a5fa" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Expensive" fill="#f87171" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Reference" fill="#fbbf24" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Retailer NPS vs Complaints Scatter */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Retailer NPS vs Complaints per 1,000</h2>
          <p className="text-xs text-gray-500 mb-3">Better retailers: high NPS (right), low complaints (bottom)</p>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="nps"
                type="number"
                name="NPS Score"
                label={{ value: 'NPS Score', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 11 }}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <YAxis
                dataKey="complaints"
                type="number"
                name="Complaints / 1,000"
                label={{ value: 'Complaints / 1,000', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(value: number, name: string) => [value.toFixed(1), name]}
              />
              <ReferenceLine x={40} stroke="#6b7280" strokeDasharray="4 2" label={{ value: 'NPS 40', fill: '#6b7280', fontSize: 10 }} />
              <Scatter
                name="Retailers"
                data={scatterData}
                fill="#a78bfa"
                opacity={0.85}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Offer Comparison Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Offer Comparison — Market Offers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase text-left">
                <th className="pb-2 pr-4">Offer ID</th>
                <th className="pb-2 pr-4">Retailer</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">Tariff Type</th>
                <th className="pb-2 pr-4">Usage Rate (¢/kWh)</th>
                <th className="pb-2 pr-4">Annual Bill</th>
                <th className="pb-2 pr-4">Discount</th>
                <th className="pb-2 pr-4">Green Power</th>
                <th className="pb-2">Contract</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o: ERCOOfferRecord) => (
                <tr key={o.offer_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-mono text-gray-400">{o.offer_id}</td>
                  <td className="py-2 pr-4 font-medium text-white">{o.retailer}</td>
                  <td className="py-2 pr-4 text-gray-300 max-w-[180px] truncate">{o.plan_name}</td>
                  <td className="py-2 pr-4">
                    <span style={{ color: REGION_COLORS[o.region] ?? '#9ca3af' }}>{o.region}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <TariffBadge tariff={o.tariff_type} />
                  </td>
                  <td className="py-2 pr-4 font-mono">{(o.usage_rate_aud_per_kwh * 100).toFixed(2)}¢</td>
                  <td className="py-2 pr-4 font-mono font-semibold text-white">${o.annual_bill_aud.toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    {o.discount_pct > 0 ? (
                      <span className="text-green-400 font-mono">{o.discount_pct.toFixed(1)}%</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {o.green_power_pct > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-400 font-mono">{o.green_power_pct.toFixed(0)}%</span>
                        <div className="w-10 bg-gray-700 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(100, o.green_power_pct)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    {o.contract_length_months === 0 ? (
                      <span className="text-gray-400">No lock-in</span>
                    ) : (
                      <span className="font-mono">{o.contract_length_months}mo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Switching Incentives Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Switching Incentives — Active Offers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase text-left">
                <th className="pb-2 pr-4">Retailer</th>
                <th className="pb-2 pr-4">Incentive Type</th>
                <th className="pb-2 pr-4">Value (AUD)</th>
                <th className="pb-2 pr-4">Conditions</th>
                <th className="pb-2 pr-4">Expiry</th>
                <th className="pb-2">Uptake %</th>
              </tr>
            </thead>
            <tbody>
              {switching_incentives.map((s: ERCOSwitchingIncentiveRecord, idx: number) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 font-medium text-white">{s.retailer}</td>
                  <td className="py-2 pr-4">
                    <IncentiveBadge type={s.incentive_type} />
                  </td>
                  <td className="py-2 pr-4 font-mono font-semibold text-emerald-400">${s.value_aud.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-gray-400">{s.conditions}</td>
                  <td className="py-2 pr-4">
                    {s.expiry_months === 0 ? (
                      <span className="text-gray-500">Ongoing</span>
                    ) : (
                      <span className="font-mono">{s.expiry_months}mo</span>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{s.uptake_pct.toFixed(1)}%</span>
                      <div className="w-14 bg-gray-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${Math.min(100, s.uptake_pct * 2.5)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complaint Categories Heatmap Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">Complaint Categories — Retailer Breakdown</h2>
        <p className="text-xs text-gray-500 mb-3">Count per 1,000 customers with YoY change; arrows indicate direction vs prior year</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase text-left">
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Retailer</th>
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">Count / 1,000</th>
                <th className="pb-2 pr-4">YoY Change</th>
                <th className="pb-2 pr-4">Resolution Rate</th>
                <th className="pb-2">Avg Resolution (days)</th>
              </tr>
            </thead>
            <tbody>
              {complaint_categories.map((c: ERCOComplaintCategoryRecord, idx: number) => {
                const heatColor =
                  c.count_per_1000 > 10 ? 'bg-red-900/30' :
                  c.count_per_1000 > 5  ? 'bg-orange-900/20' :
                  c.count_per_1000 > 2  ? 'bg-yellow-900/10' :
                  ''
                return (
                  <tr key={idx} className={`border-b border-gray-700 hover:bg-gray-750 ${heatColor}`}>
                    <td className="py-2 pr-4">
                      <span className="bg-gray-700 text-gray-200 border border-gray-600 px-2 py-0.5 rounded text-xs font-semibold">
                        {c.category}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-medium text-white">{c.retailer}</td>
                    <td className="py-2 pr-4">
                      <span style={{ color: REGION_COLORS[c.region] ?? '#9ca3af' }}>{c.region}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-semibold ${
                          c.count_per_1000 > 10 ? 'text-red-400' :
                          c.count_per_1000 > 5  ? 'text-orange-400' :
                          c.count_per_1000 > 2  ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {c.count_per_1000.toFixed(2)}
                        </span>
                        <div className="w-12 bg-gray-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              c.count_per_1000 > 10 ? 'bg-red-500' :
                              c.count_per_1000 > 5  ? 'bg-orange-500' :
                              c.count_per_1000 > 2  ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, c.count_per_1000 * 6.67)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <YoYArrow val={c.yoy_change_pct} />
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono ${c.resolution_rate_pct >= 95 ? 'text-green-400' : c.resolution_rate_pct >= 85 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {c.resolution_rate_pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 font-mono">
                      <span className={c.avg_resolution_days > 10 ? 'text-red-400' : c.avg_resolution_days > 5 ? 'text-yellow-400' : 'text-green-400'}>
                        {c.avg_resolution_days.toFixed(1)}d
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
