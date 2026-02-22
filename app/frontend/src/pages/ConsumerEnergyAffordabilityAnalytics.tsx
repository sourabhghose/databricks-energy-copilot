// Sprint 98b — Consumer Energy Bill Affordability Analytics (CEBA)

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
  Cell,
} from 'recharts'
import { Heart } from 'lucide-react'
import {
  getConsumerEnergyAffordabilityDashboard,
  CEBADashboard,
  CEBAHouseholdRecord,
  CEBARetailerOfferRecord,
  CEBAHardshipRecord,
  CEBAAffordabilityIndexRecord,
  CEBAInterventionRecord,
  CEBABillComponentRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const STATE_COLOURS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  QLD: '#fbbf24',
  SA:  '#f87171',
  WA:  '#a78bfa',
}

const COMPONENT_COLOURS: Record<string, string> = {
  'Wholesale Energy':    '#f59e0b',
  'Network Charges':     '#3b82f6',
  'Environmental Levies':'#22c55e',
  'Retail Margin':       '#ec4899',
  'Metering':            '#8b5cf6',
  'GST':                 '#6b7280',
  'Ancillary Services':  '#14b8a6',
  'Carbon Costs':        '#84cc16',
}

const QUINTILE_COLOURS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6']

const TARIFF_COLOURS: Record<string, string> = {
  Flat:   '#60a5fa',
  TOU:    '#34d399',
  Demand: '#fbbf24',
  EV:     '#a78bfa',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ConsumerEnergyAffordabilityAnalytics() {
  const [data, setData] = useState<CEBADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getConsumerEnergyAffordabilityDashboard()
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400 text-sm">
        Loading Consumer Energy Affordability data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400 text-sm">
        Error loading data: {error ?? 'Unknown error'}
      </div>
    )
  }

  const { households, retailer_offers, hardship_records, affordability_index, interventions, bill_components, summary } = data

  // ---- Derived data ----

  // Energy burden by income quintile
  const burdenByQuintile = [1, 2, 3, 4, 5].map(q => {
    const group = households.filter((h: CEBAHouseholdRecord) => h.income_quintile === q)
    const avg = group.reduce((s, h) => s + h.energy_burden_pct, 0) / (group.length || 1)
    return { quintile: `Q${q}`, avg_burden: parseFloat(avg.toFixed(1)) }
  })

  // Bill components stacked by state (c/kWh)
  const componentsByState = ['NSW', 'VIC', 'QLD', 'SA', 'WA'].map(state => {
    const stateComps = bill_components.filter((bc: CEBABillComponentRecord) => bc.state === state)
    const row: Record<string, number | string> = { state }
    stateComps.forEach(bc => { row[bc.component] = bc.value_c_per_kwh })
    return row
  })
  const componentKeys = [...new Set(bill_components.map((bc: CEBABillComponentRecord) => bc.component))]

  // Affordability index trend (median_bill_aud) by state per quarter
  const trendQuarters = ['Q1-2024', 'Q2-2024', 'Q3-2024', 'Q4-2024']
  const affordabilityTrend = trendQuarters.map(quarter => {
    const row: Record<string, number | string> = { quarter }
    affordability_index
      .filter((ai: CEBAAffordabilityIndexRecord) => ai.quarter === quarter)
      .forEach(ai => { row[ai.region] = ai.median_bill_aud })
    return row
  })

  // Retailer bill comparison by tariff type
  const tariffBills: Record<string, { total: number; count: number }> = {}
  retailer_offers.forEach((o: CEBARetailerOfferRecord) => {
    if (!tariffBills[o.tariff_type]) tariffBills[o.tariff_type] = { total: 0, count: 0 }
    tariffBills[o.tariff_type].total += o.annual_bill_typical_aud
    tariffBills[o.tariff_type].count += 1
  })
  const retailerTariffData = Object.entries(tariffBills).map(([tariff, { total, count }]) => ({
    tariff,
    avg_bill: parseFloat((total / count).toFixed(2)),
  }))

  // Hardship performance: latest quarter per retailer
  const latestQuarter = 'Q2-2024'
  const hardshipLatest = hardship_records.filter((h: CEBAHardshipRecord) => h.quarter === latestQuarter)

  // KPI values
  const nationalMedianBill = summary.national_median_bill_aud ?? 0
  const avgBurden = summary.avg_energy_burden_pct ?? 0
  const pctBillStress = summary.pct_in_bill_stress ?? 0
  const totalHardship = summary.total_hardship_customers ?? 0

  return (
    <div className="min-h-full bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Heart size={28} className="text-rose-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Consumer Energy Bill Affordability Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Household energy burden, retailer offers, hardship programs and government interventions
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="National Median Bill"
          value={`$${nationalMedianBill.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub="Electricity + Gas combined (p.a.)"
        />
        <KpiCard
          label="Avg Energy Burden"
          value={`${avgBurden.toFixed(1)}%`}
          sub="Energy cost as % of income"
        />
        <KpiCard
          label="Bill Stress Households"
          value={`${pctBillStress.toFixed(1)}%`}
          sub="Households spending >10% on energy"
        />
        <KpiCard
          label="Hardship Customers"
          value={totalHardship.toLocaleString()}
          sub="Across all retailers (Q2-2024)"
        />
      </div>

      {/* Row 1: Burden by Quintile + Bill Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Energy Burden by Income Quintile */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Energy Burden by Income Quintile (%)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={burdenByQuintile} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quintile" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" domain={[0, 20]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, 'Avg Energy Burden']}
              />
              <Bar dataKey="avg_burden" radius={[4, 4, 0, 0]}>
                {burdenByQuintile.map((_, i) => (
                  <Cell key={i} fill={QUINTILE_COLOURS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2">Q1 = lowest income quintile, Q5 = highest</p>
        </div>

        {/* Bill Components by State (Stacked Bar) */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Bill Components by State (c/kWh)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={componentsByState} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="c" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number, name: string) => [`${v.toFixed(2)}c/kWh`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {componentKeys.map(comp => (
                <Bar key={comp} dataKey={comp} stackId="a" fill={COMPONENT_COLOURS[comp] ?? '#6b7280'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Affordability Trend + Retailer Bill Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Affordability Index Trend */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Median Bill Trend by State (2024, AUD p.a.)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={affordabilityTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="$" domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number, name: string) => [`$${v.toFixed(0)}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {Object.keys(STATE_COLOURS).map(state => (
                <Line
                  key={state}
                  type="monotone"
                  dataKey={state}
                  stroke={STATE_COLOURS[state]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Retailer Bill Comparison by Tariff Type */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Avg Retailer Bill by Tariff Type (AUD p.a.)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={retailerTariffData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="tariff" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="$" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`$${v.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`, 'Avg Annual Bill']}
              />
              <Bar dataKey="avg_bill" radius={[4, 4, 0, 0]}>
                {retailerTariffData.map((d, i) => (
                  <Cell key={i} fill={TARIFF_COLOURS[d.tariff] ?? '#60a5fa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hardship Program Performance Table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Hardship Program Performance — {latestQuarter}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase">
                <th className="pb-2 pr-4">Retailer</th>
                <th className="pb-2 pr-4">State</th>
                <th className="pb-2 pr-4 text-right">On Program</th>
                <th className="pb-2 pr-4 text-right">New QTD</th>
                <th className="pb-2 pr-4 text-right">Resolved QTD</th>
                <th className="pb-2 pr-4 text-right">Avg Debt ($)</th>
                <th className="pb-2 pr-4 text-right">Disconnections</th>
                <th className="pb-2 text-right">Avg Days to Resolve</th>
              </tr>
            </thead>
            <tbody>
              {hardshipLatest.map((h: CEBAHardshipRecord) => (
                <tr key={h.hardship_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-gray-200 font-medium">{h.retailer}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-semibold"
                      style={{ backgroundColor: (STATE_COLOURS[h.state] ?? '#6b7280') + '30', color: STATE_COLOURS[h.state] ?? '#9ca3af' }}
                    >
                      {h.state}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-200">{h.customers_on_hardship_program.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-emerald-400">+{h.new_customers_qtd.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-sky-400">{h.resolved_customers_qtd.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-amber-400">${h.average_debt_aud.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td className="py-2 pr-4 text-right text-red-400">{h.disconnections.toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-300">{h.avg_time_to_resolve_days.toFixed(0)}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Government Interventions Table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Government Interventions &amp; Assistance Programs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 uppercase">
                <th className="pb-2 pr-4">Program</th>
                <th className="pb-2 pr-4">Jurisdiction</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4 text-right">Value/HH ($)</th>
                <th className="pb-2 pr-4 text-right">Eligible (k HH)</th>
                <th className="pb-2 pr-4 text-right">Uptake (%)</th>
                <th className="pb-2 pr-4 text-right">Annual Cost ($M)</th>
                <th className="pb-2 pr-4 text-right">Effectiveness</th>
                <th className="pb-2">Target Group</th>
              </tr>
            </thead>
            <tbody>
              {interventions.map((iv: CEBAInterventionRecord) => {
                const stars = Math.round(iv.effectiveness_rating)
                const starColor = iv.effectiveness_rating >= 4.3 ? 'text-emerald-400' : iv.effectiveness_rating >= 3.8 ? 'text-amber-400' : 'text-red-400'
                return (
                  <tr key={iv.intervention_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                    <td className="py-2 pr-4 text-gray-200 font-medium max-w-[160px] truncate">{iv.program_name}</td>
                    <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{iv.jurisdiction}</td>
                    <td className="py-2 pr-4">
                      <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{iv.intervention_type}</span>
                    </td>
                    <td className="py-2 pr-4 text-right text-emerald-400">${iv.value_per_household_aud.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right text-gray-300">{(iv.num_households_eligible / 1000).toFixed(0)}k</td>
                    <td className="py-2 pr-4 text-right text-sky-400">{iv.uptake_rate_pct.toFixed(0)}%</td>
                    <td className="py-2 pr-4 text-right text-amber-400">${iv.annual_cost_m.toFixed(1)}M</td>
                    <td className={`py-2 pr-4 text-right font-semibold ${starColor}`}>{iv.effectiveness_rating.toFixed(1)}/5</td>
                    <td className="py-2 text-gray-400 text-xs max-w-[140px] truncate">{iv.target_group}</td>
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
