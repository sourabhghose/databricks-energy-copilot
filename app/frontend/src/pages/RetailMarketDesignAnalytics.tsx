import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
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
  ERMDDashboard,
  getRetailMarketDesignDashboard,
} from '../api/client'

export default function RetailMarketDesignAnalytics() {
  const [data, setData] = useState<ERMDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRetailMarketDesignDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Retail Market Design data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data available'}
      </div>
    )
  }

  const { summary, default_offers, price_caps, market_offers, consumer_segments, compliance } = data

  // KPI values
  const nationalAvgDmo = typeof summary.national_avg_dmo_aud === 'number'
    ? summary.national_avg_dmo_aud.toFixed(0)
    : '—'
  const avgMarketOffer = typeof summary.avg_market_offer_aud === 'number'
    ? summary.avg_market_offer_aud.toFixed(0)
    : '—'
  const savingsSwitching = typeof summary.savings_switching_to_best_aud === 'number'
    ? summary.savings_switching_to_best_aud.toFixed(0)
    : '—'
  const standingOfferPct = typeof summary.customers_on_standing_offer_pct === 'number'
    ? summary.customers_on_standing_offer_pct.toFixed(1)
    : '—'

  // Bar chart: DMO vs standing vs best market by state
  const stateOfferMap: Record<string, { dmo: number[]; standing: number[]; best: number[] }> = {}
  default_offers.forEach((r) => {
    if (!stateOfferMap[r.state]) stateOfferMap[r.state] = { dmo: [], standing: [], best: [] }
    stateOfferMap[r.state].dmo.push(r.dmo_rate_dollar_pa)
    stateOfferMap[r.state].standing.push(r.standing_offer_rate_dollar_pa)
    stateOfferMap[r.state].best.push(r.market_offer_best_dollar_pa)
  })
  const stateOfferData = Object.entries(stateOfferMap).map(([state, vals]) => ({
    state,
    DMO: Math.round(vals.dmo.reduce((a, b) => a + b, 0) / vals.dmo.length),
    'Standing Offer': Math.round(vals.standing.reduce((a, b) => a + b, 0) / vals.standing.length),
    'Best Market': Math.round(vals.best.reduce((a, b) => a + b, 0) / vals.best.length),
  }))

  // Line chart: price cap trends 2020-2024 by jurisdiction
  const yearJurMap: Record<number, Record<string, number[]>> = {}
  price_caps.forEach((r) => {
    if (!yearJurMap[r.year]) yearJurMap[r.year] = {}
    if (!yearJurMap[r.year][r.jurisdiction]) yearJurMap[r.year][r.jurisdiction] = []
    yearJurMap[r.year][r.jurisdiction].push(r.residential_flat_c_per_kwh)
  })
  const priceCapTrendData = Object.entries(yearJurMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, jurVals]) => {
      const row: Record<string, number | string> = { year: Number(year) }
      Object.entries(jurVals).forEach(([jur, vals]) => {
        row[jur] = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
      })
      return row
    })

  // Bar chart: market offer unconditional discount by retailer
  const retailerDiscountMap: Record<string, number[]> = {}
  market_offers.forEach((r) => {
    if (!retailerDiscountMap[r.retailer]) retailerDiscountMap[r.retailer] = []
    retailerDiscountMap[r.retailer].push(r.unconditional_discount_pct)
  })
  const retailerDiscountData = Object.entries(retailerDiscountMap).map(([retailer, vals]) => ({
    retailer,
    'Avg Unconditional Discount %': parseFloat(
      (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
    ),
  }))

  // Bar chart: consumer overpayment by segment
  const segmentOverpayMap: Record<string, number[]> = {}
  consumer_segments.forEach((r) => {
    if (!segmentOverpayMap[r.segment_name]) segmentOverpayMap[r.segment_name] = []
    segmentOverpayMap[r.segment_name].push(r.overpaying_vs_best_aud)
  })
  const segmentOverpayData = Object.entries(segmentOverpayMap).map(([segment, vals]) => ({
    segment,
    'Avg Overpayment $': Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }))

  // Compliance summary by retailer
  const compRetailerMap: Record<string, { penalties: number; actions: string[]; complaints: number[] }> = {}
  compliance.forEach((r) => {
    if (!compRetailerMap[r.retailer]) compRetailerMap[r.retailer] = { penalties: 0, actions: [], complaints: [] }
    compRetailerMap[r.retailer].penalties += r.financial_penalty_m
    compRetailerMap[r.retailer].actions.push(r.regulatory_action)
    compRetailerMap[r.retailer].complaints.push(r.complaints_per_1000_customers)
  })
  const complianceSummary = Object.entries(compRetailerMap).map(([retailer, vals]) => {
    const worstAction = vals.actions.includes('Court Action')
      ? 'Court Action'
      : vals.actions.includes('Infringement')
        ? 'Infringement'
        : vals.actions.includes('Warning')
          ? 'Warning'
          : 'None'
    return {
      retailer,
      totalPenaltyM: parseFloat(vals.penalties.toFixed(2)),
      worstAction,
      avgComplaints: parseFloat(
        (vals.complaints.reduce((a, b) => a + b, 0) / vals.complaints.length).toFixed(2)
      ),
    }
  })

  const actionBadgeColor = (action: string) => {
    switch (action) {
      case 'Court Action': return 'bg-red-700 text-red-100'
      case 'Infringement': return 'bg-orange-700 text-orange-100'
      case 'Warning': return 'bg-yellow-700 text-yellow-100'
      default: return 'bg-green-800 text-green-200'
    }
  }

  const jurisdictionColors: Record<string, string> = {
    NSW: '#60a5fa',
    VIC: '#34d399',
    QLD: '#f97316',
    SA: '#a78bfa',
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShoppingBag className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Retail Market Design Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">
            Default Market Offer · Victorian Default Offer · Standing Offers · Price Caps
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">National Avg DMO</p>
          <p className="text-2xl font-bold text-blue-400">${nationalAvgDmo}</p>
          <p className="text-xs text-gray-500 mt-1">per annum residential</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Avg Market Offer</p>
          <p className="text-2xl font-bold text-green-400">${avgMarketOffer}</p>
          <p className="text-xs text-gray-500 mt-1">typical annual bill</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Switching Savings</p>
          <p className="text-2xl font-bold text-yellow-400">${savingsSwitching}</p>
          <p className="text-xs text-gray-500 mt-1">DMO vs best market offer</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">On Standing Offer</p>
          <p className="text-2xl font-bold text-red-400">{standingOfferPct}%</p>
          <p className="text-xs text-gray-500 mt-1">customers (avg across segments)</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DMO vs Standing vs Best Market by State */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            DMO / Standing Offer / Best Market — Average by State ($pa)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stateOfferData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Bar dataKey="DMO" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Standing Offer" fill="#f87171" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Best Market" fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Price Cap Trends 2020-2024 */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Price Cap Trends 2020–2024 — Residential Flat Rate (c/kWh) by Jurisdiction
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={priceCapTrendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${v}c`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`${v}c/kWh`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              {Object.keys(jurisdictionColors).map((jur) => (
                <Line
                  key={jur}
                  type="monotone"
                  dataKey={jur}
                  stroke={jurisdictionColors[jur]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unconditional Discount by Retailer */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Market Offer Competitiveness — Avg Unconditional Discount by Retailer (%)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={retailerDiscountData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="retailer" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={95} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`${v}%`, 'Discount']}
              />
              <Bar dataKey="Avg Unconditional Discount %" fill="#a78bfa" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Consumer Overpayment by Segment */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Consumer Overpayment vs Best Offer — Average by Segment ($pa)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={segmentOverpayData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <YAxis dataKey="segment" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={115} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, 'Avg Overpayment']}
              />
              <Bar dataKey="Avg Overpayment $" fill="#f97316" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Default Offer Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Default Offer Details by Network Area
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {['State', 'Network Area', 'Year', 'DMO $pa', 'VDO $pa', 'Standing $pa', 'Best Market $pa', 'Savings vs Standing', 'Active Retailers'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-gray-400 font-medium text-xs whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {default_offers.slice(0, 15).map((r) => (
                <tr key={r.offer_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 px-3 text-gray-300 font-medium">{r.state}</td>
                  <td className="py-2 px-3 text-gray-400 text-xs">{r.network_area}</td>
                  <td className="py-2 px-3 text-gray-400">{r.determination_year}</td>
                  <td className="py-2 px-3 text-blue-400">${r.dmo_rate_dollar_pa.toLocaleString()}</td>
                  <td className="py-2 px-3 text-cyan-400">
                    {r.vdo_rate_dollar_pa > 0 ? `$${r.vdo_rate_dollar_pa.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-2 px-3 text-red-400">${r.standing_offer_rate_dollar_pa.toLocaleString()}</td>
                  <td className="py-2 px-3 text-green-400">${r.market_offer_best_dollar_pa.toLocaleString()}</td>
                  <td className="py-2 px-3">
                    <span className="text-green-400 font-semibold">{r.regulated_offer_savings_vs_standing_pct}%</span>
                  </td>
                  <td className="py-2 px-3 text-gray-300">{r.retailer_count_active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Compliance Summary by Retailer (2023–2024)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {['Retailer', 'Avg Complaints /1000', 'Total Penalty $M', 'Worst Action'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-gray-400 font-medium text-xs">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {complianceSummary.map((r) => (
                <tr key={r.retailer} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 px-3 text-gray-200 font-medium">{r.retailer}</td>
                  <td className="py-2 px-3 text-gray-300">{r.avgComplaints}</td>
                  <td className="py-2 px-3 text-yellow-400">
                    {r.totalPenaltyM > 0 ? `$${r.totalPenaltyM.toFixed(2)}M` : '—'}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionBadgeColor(r.worstAction)}`}>
                      {r.worstAction}
                    </span>
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
