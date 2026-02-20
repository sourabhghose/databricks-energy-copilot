import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { TrendingUp, DollarSign, ShoppingCart, Award } from 'lucide-react'
import { getElectricityPriceIndexDashboard, ElectricityPriceIndexDashboard } from '../api/client'

const STATE_COLORS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#10b981',
  QLD: '#f59e0b',
  SA:  '#ef4444',
  WA:  '#8b5cf6',
}

const TARIFF_COLORS = {
  network_charges_aud_kwh:       '#3b82f6',
  wholesale_charges_aud_kwh:     '#f59e0b',
  environmental_charges_aud_kwh: '#10b981',
  retail_margin_aud_kwh:         '#ef4444',
}

const SATISFACTION_COLOR = (score: number): string => {
  if (score >= 8) return 'text-green-400'
  if (score >= 7) return 'text-yellow-400'
  return 'text-red-400'
}

export default function ElectricityPriceIndex() {
  const [data, setData] = useState<ElectricityPriceIndexDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getElectricityPriceIndexDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
  )
  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-400">Error: {error}</div>
  )
  if (!data) return null

  // --- KPI computations ---
  const nswCpiQ2 = data.cpi_records.find(
    (r: any) => r.state === 'NSW' && r.quarter === '2024-Q2'
  )
  const latestElecCpiYoY = nswCpiQ2 ? nswCpiQ2.electricity_cpi_yoy_pct : 0
  const latestElecVsAllPremium = nswCpiQ2 ? nswCpiQ2.electricity_vs_all_cpi_diff_pct : 0

  const maxSaving = Math.max(...data.dmo_records.map((r: any) => r.potential_saving_aud))
  const maxSavingRecord = data.dmo_records.find((r: any) => r.potential_saving_aud === maxSaving) as any

  const maxShareRetailer = data.retailers.reduce((best: any, r: any) =>
    r.market_share_pct > (best?.market_share_pct ?? -1) ? r : best, null as any
  )

  // --- CPI line chart data (NSW only for clarity) ---
  const cpiChartData = ['2023-Q1', '2023-Q2', '2023-Q3', '2023-Q4', '2024-Q1', '2024-Q2'].map(q => {
    const nswRec = data.cpi_records.find((r: any) => r.state === 'NSW' && r.quarter === q) as any
    return {
      quarter:    q,
      elecCpi:    nswRec?.electricity_cpi_yoy_pct ?? 0,
      allCpi:     nswRec?.all_cpi_yoy_pct ?? 0,
      elecIndex:  nswRec?.electricity_cpi_index ?? 0,
      allIndex:   nswRec?.all_cpi_index ?? 0,
    }
  })

  // --- DMO vs market offer bar chart (2024 by state) ---
  const dmoChartData = ['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(state => {
    const rec = data.dmo_records.find((r: any) => r.state === state && r.year === 2024) as any
    return {
      state,
      dmo:        rec?.dmo_price_aud ?? 0,
      marketAvg:  rec?.market_offer_avg_aud ?? 0,
      bestOffer:  rec?.best_market_offer_aud ?? 0,
    }
  })

  // --- Tariff stacked area (NSW, 2021-2024) ---
  const tariffData = [2021, 2022, 2023, 2024].map(year => {
    const rec = data.tariff_components.find((r: any) => r.state === 'NSW' && r.year === year) as any
    return {
      year: String(year),
      network:     rec?.network_charges_aud_kwh ?? 0,
      wholesale:   rec?.wholesale_charges_aud_kwh ?? 0,
      environmental: rec?.environmental_charges_aud_kwh ?? 0,
      retail:      rec?.retail_margin_aud_kwh ?? 0,
    }
  })

  // --- Retailer table (sorted by market share desc) ---
  const sortedRetailers = [...data.retailers].sort((a: any, b: any) => b.market_share_pct - a.market_share_pct)

  return (
    <div className="p-6 space-y-6 bg-slate-900 min-h-screen text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShoppingCart className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Consumer Price Index &amp; Retail Market Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">
            CPI electricity sub-index, DMO/VDO default offer analytics, tariff decomposition, and retailer benchmarking
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-red-400" />
            <span className="text-slate-400 text-sm">Latest Electricity CPI YoY (NSW)</span>
          </div>
          <p className="text-2xl font-bold text-red-400">+{latestElecCpiYoY.toFixed(1)}%</p>
          <p className="text-slate-500 text-xs mt-1">2024-Q2</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <span className="text-slate-400 text-sm">Elec vs All-CPI Premium</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">+{latestElecVsAllPremium.toFixed(1)}%</p>
          <p className="text-slate-500 text-xs mt-1">Electricity outpacing headline CPI</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-slate-400 text-sm">Max DMO Saving (2024)</span>
          </div>
          <p className="text-2xl font-bold text-green-400">${maxSaving.toFixed(0)}</p>
          <p className="text-slate-500 text-xs mt-1">
            {maxSavingRecord ? `${maxSavingRecord.state} vs best market offer` : ''}
          </p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-blue-400" />
            <span className="text-slate-400 text-sm">Highest Market Share Retailer</span>
          </div>
          <p className="text-xl font-bold text-blue-400">{maxShareRetailer?.retailer ?? '—'}</p>
          <p className="text-slate-500 text-xs mt-1">
            {maxShareRetailer ? `${maxShareRetailer.market_share_pct}% share (${maxShareRetailer.state})` : ''}
          </p>
        </div>
      </div>

      {/* CPI Comparison Line Chart */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-1">CPI Comparison: Electricity vs All-CPI (NSW)</h2>
        <p className="text-slate-400 text-xs mb-4">Year-on-year % change — electricity CPI (left axis) vs all-CPI (right axis)</p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={cpiChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="quarter" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={v => `${v}%`}
              domain={[0, 25]}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={v => `${v}%`}
              domain={[0, 10]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
              formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
            />
            <Legend />
            <ReferenceLine yAxisId="left" y={7} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'RBA 7%', fill: '#ef4444', fontSize: 10 }} />
            <Line yAxisId="left" type="monotone" dataKey="elecCpi" name="Electricity CPI YoY %" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
            <Line yAxisId="right" type="monotone" dataKey="allCpi" name="All CPI YoY %" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* DMO vs Market Offer Bar Chart */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-1">DMO vs Market Offer by State (2024)</h2>
        <p className="text-slate-400 text-xs mb-4">Annual bill AUD for reference usage — Default Market Offer, average market offer, and best market offer</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dmoChartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="state" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `$${v}`} domain={[1000, 2500]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
              formatter={(v: number) => [`$${v.toFixed(0)}`, '']}
            />
            <Legend />
            <Bar dataKey="dmo" name="DMO Price (AUD)" fill="#ef4444" radius={[3, 3, 0, 0]} />
            <Bar dataKey="marketAvg" name="Avg Market Offer (AUD)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="bestOffer" name="Best Market Offer (AUD)" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tariff Component Stacked Area Chart */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-1">Tariff Component Breakdown — NSW (2021–2024)</h2>
        <p className="text-slate-400 text-xs mb-4">AUD/kWh decomposition: network, wholesale, environmental, retail margin</p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={tariffData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `$${v.toFixed(2)}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
              formatter={(v: number) => [`$${v.toFixed(4)}/kWh`, '']}
            />
            <Legend />
            <Area type="monotone" dataKey="network"       name="Network Charges"      stackId="1" fill={TARIFF_COLORS.network_charges_aud_kwh}       stroke={TARIFF_COLORS.network_charges_aud_kwh}       fillOpacity={0.8} />
            <Area type="monotone" dataKey="wholesale"     name="Wholesale Charges"    stackId="1" fill={TARIFF_COLORS.wholesale_charges_aud_kwh}     stroke={TARIFF_COLORS.wholesale_charges_aud_kwh}     fillOpacity={0.8} />
            <Area type="monotone" dataKey="environmental" name="Environmental Charges" stackId="1" fill={TARIFF_COLORS.environmental_charges_aud_kwh} stroke={TARIFF_COLORS.environmental_charges_aud_kwh} fillOpacity={0.8} />
            <Area type="monotone" dataKey="retail"        name="Retail Margin"        stackId="1" fill={TARIFF_COLORS.retail_margin_aud_kwh}         stroke={TARIFF_COLORS.retail_margin_aud_kwh}         fillOpacity={0.8} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Retailer Comparison Table */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Retailer Benchmarking</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 px-3">Retailer</th>
                <th className="text-left py-2 px-3">State</th>
                <th className="text-right py-2 px-3">Market Share</th>
                <th className="text-right py-2 px-3">Avg Offer</th>
                <th className="text-right py-2 px-3">Cheapest Offer</th>
                <th className="text-right py-2 px-3">Satisfaction</th>
                <th className="text-right py-2 px-3">Complaints/1000</th>
                <th className="text-right py-2 px-3">Churn Rate</th>
              </tr>
            </thead>
            <tbody>
              {sortedRetailers.map((r: any, i: number) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="py-2 px-3 font-medium text-white">{r.retailer}</td>
                  <td className="py-2 px-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: `${STATE_COLORS[r.state]}22`, color: STATE_COLORS[r.state] }}
                    >
                      {r.state}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-blue-400"
                          style={{ width: `${Math.min(r.market_share_pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-slate-200">{r.market_share_pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-slate-200">${r.avg_offer_aud.toFixed(0)}</td>
                  <td className="py-2 px-3 text-right text-green-400">${r.cheapest_offer_aud.toFixed(0)}</td>
                  <td className={`py-2 px-3 text-right font-semibold ${SATISFACTION_COLOR(r.customer_satisfaction_score)}`}>
                    {r.customer_satisfaction_score.toFixed(1)}/10
                  </td>
                  <td className="py-2 px-3 text-right text-slate-300">{r.complaints_per_1000.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right text-amber-400">{r.churn_rate_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-slate-600 text-xs text-right">
        Data as of {new Date(data.timestamp).toLocaleString()} — AER DMO / ABS CPI Series reference data
      </p>
    </div>
  )
}
