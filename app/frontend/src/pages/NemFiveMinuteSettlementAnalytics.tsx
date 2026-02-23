import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
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
  getNemFiveMinuteSettlementDashboard,
  NFMSDashboard,
  NFMSInterval,
  NFMSGenerator,
  NFMSPriceSpike,
  NFMSBattery,
  NFMSMarketImpact,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const ADAPTION_COLORS: Record<string, string> = {
  Adapted:  '#22c55e',
  Adapting: '#f59e0b',
  Lagging:  '#ef4444',
}

const YEAR_COLORS: Record<number, string> = {
  2022: '#6366f1',
  2023: '#f59e0b',
  2024: '#22c55e',
}

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4']

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
// Chart 1 — Bar: price_divergence_mwh by region × year (grouped)
// ---------------------------------------------------------------------------

function PriceDivergenceChart({ intervals }: { intervals: NFMSInterval[] }) {
  // Average divergence per region per year
  const regionYearMap: Record<string, Record<number, number[]>> = {}
  for (const iv of intervals) {
    if (!regionYearMap[iv.region]) regionYearMap[iv.region] = {}
    if (!regionYearMap[iv.region][iv.year]) regionYearMap[iv.region][iv.year] = []
    regionYearMap[iv.region][iv.year].push(iv.price_divergence_mwh)
  }

  const data = Object.entries(regionYearMap).map(([region, yearData]) => {
    const row: Record<string, string | number> = { region }
    for (const year of [2022, 2023, 2024]) {
      const vals = yearData[year] ?? []
      row[`y${year}`] = vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : 0
    }
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Avg Price Divergence ($/MWh) by Region &amp; Year
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number) => [`${val.toFixed(2)} $/MWh`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar dataKey="y2022" name="2022" fill={YEAR_COLORS[2022]} radius={[2,2,0,0]} isAnimationActive={false} />
          <Bar dataKey="y2023" name="2023" fill={YEAR_COLORS[2023]} radius={[2,2,0,0]} isAnimationActive={false} />
          <Bar dataKey="y2024" name="2024" fill={YEAR_COLORS[2024]} radius={[2,2,0,0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Bar: generator rebid_frequency_per_day coloured by adaption_status
// ---------------------------------------------------------------------------

function GeneratorRebidChart({ generators }: { generators: NFMSGenerator[] }) {
  const sorted = [...generators].sort((a, b) => b.rebid_frequency_per_day - a.rebid_frequency_per_day)
  const data = sorted.map(g => ({
    name: g.generator_name.length > 16 ? g.generator_name.slice(0, 16) + '…' : g.generator_name,
    fullName: g.generator_name,
    rebid_frequency_per_day: g.rebid_frequency_per_day,
    adaption_status: g.adaption_status,
    fill: ADAPTION_COLORS[g.adaption_status] ?? '#6b7280',
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Generator Rebid Frequency (per day) by Adaption Status
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-40} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Rebids/day', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number, _name: string, props: { payload?: { fullName?: string; adaption_status?: string } }) => [
              `${val.toFixed(2)} rebids/day`,
              `${props?.payload?.fullName} (${props?.payload?.adaption_status})`,
            ]}
          />
          <Bar dataKey="rebid_frequency_per_day" name="Rebids/day" radius={[4,4,0,0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <rect key={`gen-cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(ADAPTION_COLORS).map(([st, col]) => (
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
// Chart 3 — Bar: quarterly spike_count_above_300 by region for 2022-2024
// ---------------------------------------------------------------------------

function PriceSpikeChart({ priceSpikes }: { priceSpikes: NFMSPriceSpike[] }) {
  // Group by region, sum spike_count_above_300 across all years/quarters
  const regionMap: Record<string, { '2022': number; '2023': number; '2024': number }> = {}
  for (const spike of priceSpikes) {
    if (!regionMap[spike.region]) regionMap[spike.region] = { '2022': 0, '2023': 0, '2024': 0 }
    const yr = String(spike.year) as '2022' | '2023' | '2024'
    regionMap[spike.region][yr] += spike.spike_count_above_300
  }

  const data = Object.entries(regionMap).map(([region, counts]) => ({
    region,
    '2022': counts['2022'],
    '2023': counts['2023'],
    '2024': counts['2024'],
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Price Spike Count (above $300/MWh) by Region — 2022 to 2024
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Spike count', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number) => [`${val} spikes`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar dataKey="2022" name="2022" fill={YEAR_COLORS[2022]} radius={[2,2,0,0]} isAnimationActive={false} />
          <Bar dataKey="2023" name="2023" fill={YEAR_COLORS[2023]} radius={[2,2,0,0]} isAnimationActive={false} />
          <Bar dataKey="2024" name="2024" fill={YEAR_COLORS[2024]} radius={[2,2,0,0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Bar: battery 5ms_benefit_vs_30ms_pct sorted descending
// ---------------------------------------------------------------------------

function BatteryBenefitChart({ batteries }: { batteries: NFMSBattery[] }) {
  const sorted = [...batteries].sort((a, b) => b.five_ms_benefit_vs_30ms_pct - a.five_ms_benefit_vs_30ms_pct)
  const data = sorted.map(b => ({
    name: b.asset_name.length > 15 ? b.asset_name.slice(0, 15) + '…' : b.asset_name,
    fullName: b.asset_name,
    five_ms_benefit_vs_30ms_pct: b.five_ms_benefit_vs_30ms_pct,
    region: b.region,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Battery 5MS Benefit vs 30-Min Settlement (%) — Sorted Descending
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-40} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number, _name: string, props: { payload?: { fullName?: string; region?: string } }) => [
              `${val.toFixed(1)}%`,
              `${props?.payload?.fullName} (${props?.payload?.region})`,
            ]}
          />
          <Bar dataKey="five_ms_benefit_vs_30ms_pct" name="5MS Benefit %" fill="#06b6d4" radius={[4,4,0,0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Line: quarterly reform_benefit_m_aud vs consumer_impact trend
// ---------------------------------------------------------------------------

function ReformTrendChart({ marketImpact }: { marketImpact: NFMSMarketImpact[] }) {
  // Group by year-quarter, average values
  const map: Record<string, { reform: number[]; consumer: number[] }> = {}
  for (const mi of marketImpact) {
    const key = `${mi.year} ${mi.quarter}`
    if (!map[key]) map[key] = { reform: [], consumer: [] }
    map[key].reform.push(mi.reform_benefit_m_aud)
    map[key].consumer.push(mi.consumer_impact_m_aud)
  }

  const data = Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => ({
      period: key,
      reform_benefit: Math.round((vals.reform.reduce((a, b) => a + b, 0) / vals.reform.length) * 100) / 100,
      consumer_impact: Math.round((vals.consumer.reduce((a, b) => a + b, 0) / vals.consumer.length) * 100) / 100,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Quarterly Reform Benefit ($M) vs Consumer Impact ($M) Trend
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-30} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '$M AUD', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number) => [`$${val.toFixed(2)}M`]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="reform_benefit"
            name="Reform Benefit $M"
            stroke={LINE_COLORS[0]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="consumer_impact"
            name="Consumer Impact $M"
            stroke={LINE_COLORS[2]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NemFiveMinuteSettlementAnalytics() {
  const [data, setData] = useState<NFMSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNemFiveMinuteSettlementDashboard()
      .then(setData)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-400 animate-pulse">Loading 5-Min Settlement Analytics…</span>
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
        <div className="p-2 rounded-lg bg-blue-600">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            NEM Five-Minute Settlement Analytics
          </h1>
          <p className="text-sm text-gray-400">
            Post-5MS reform market impact, generator adaptation and battery arbitrage (Oct 2021 onwards)
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Avg Price Divergence"
          value={`${summary.avg_price_divergence_mwh.toFixed(2)} $/MWh`}
          sub="5-min vs 30-min settlement"
        />
        <KpiCard
          label="Total Rebid Events/yr"
          value={summary.total_rebid_events_pa.toLocaleString()}
          sub="across all intervals"
        />
        <KpiCard
          label="Consumer Savings"
          value={`$${summary.consumer_savings_m_aud.toFixed(1)}M`}
          sub="AUD from 5MS reform"
        />
        <KpiCard
          label="Reform Benefit Total"
          value={`$${summary.reform_benefit_total_m_aud.toFixed(1)}M`}
          sub="cumulative market benefit"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PriceDivergenceChart intervals={data.intervals} />
        <GeneratorRebidChart generators={data.generators} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PriceSpikeChart priceSpikes={data.price_spikes} />
        <BatteryBenefitChart batteries={data.batteries} />
      </div>

      {/* Chart row 3 */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <ReformTrendChart marketImpact={data.market_impact} />
      </div>

      {/* Summary footer */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">5MS Reform Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Most Impacted Region</span>
            <p className="text-white font-semibold">{summary.most_impacted_region}</p>
          </div>
          <div>
            <span className="text-gray-500">Batteries Benefited</span>
            <p className="text-white font-semibold">{summary.batteries_benefited_count}</p>
          </div>
          <div>
            <span className="text-gray-500">Generator Revenue Change</span>
            <p className="text-white font-semibold">{summary.generator_revenue_change_pct.toFixed(2)}%</p>
          </div>
          <div>
            <span className="text-gray-500">Total Rebid Events/yr</span>
            <p className="text-white font-semibold">{summary.total_rebid_events_pa.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
