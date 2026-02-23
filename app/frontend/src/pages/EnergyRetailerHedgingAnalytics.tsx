import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Shield } from 'lucide-react'
import {
  getEnergyRetailerHedgingDashboard,
  ERHADashboard,
} from '../api/client'

// ── Colour palettes ────────────────────────────────────────────────────────
const RETAILER_COLOURS: Record<string, string> = {
  'AGL Energy':       '#3b82f6',
  'Origin Energy':    '#10b981',
  'EnergyAustralia':  '#f59e0b',
  'Simply Energy':    '#8b5cf6',
  'Alinta Energy':    '#ef4444',
}

const CONTRACT_COLOURS: Record<string, string> = {
  'Swap':         '#3b82f6',
  'Cap':          '#10b981',
  'Floor':        '#f59e0b',
  'Collar':       '#8b5cf6',
  'ASX Futures':  '#ef4444',
  'OTC Forward':  '#06b6d4',
}

const RATING_COLOURS: Record<string, string> = {
  'AAA': '#10b981',
  'AA':  '#3b82f6',
  'A':   '#f59e0b',
  'BBB': '#f97316',
  'BB':  '#ef4444',
  'B':   '#7f1d1d',
}

const REGION_COLOURS: Record<string, string> = {
  'NSW1': '#3b82f6',
  'QLD1': '#f59e0b',
  'VIC1': '#10b981',
  'SA1':  '#8b5cf6',
}

const RETAILERS = ['AGL Energy', 'Origin Energy', 'EnergyAustralia', 'Simply Energy', 'Alinta Energy']
const CONTRACT_TYPES = ['Swap', 'Cap', 'Floor', 'Collar', 'ASX Futures', 'OTC Forward']
const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1']
const SCENARIOS = ['Price +50%', 'Price -30%', 'Volume +20%', 'Volume -20%', 'Extreme Heat Event', 'Interconnector Failure']

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs text-gray-400 truncate">{label}</span>
      <span className="text-2xl font-bold text-white leading-none">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500 mt-0.5">{sub}</span>}
    </div>
  )
}

// ── Chart Section Wrapper ──────────────────────────────────────────────────
function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function EnergyRetailerHedgingAnalytics() {
  const [data, setData] = useState<ERHADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyRetailerHedgingDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Energy Retailer Hedging Analytics...
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data.'}
      </div>
    )

  const { hedge_book, counterparty_exposure, hedging_costs, volatility_metrics, stress_tests, summary } = data

  // ── Chart 1: Stacked bar — hedge_volume_gwh by retailer × contract_type (2024 only) ──
  const hb2024 = hedge_book.filter(h => h.year === 2024)
  const chart1Map: Record<string, Record<string, number>> = {}
  for (const retailer of RETAILERS) chart1Map[retailer] = {}
  for (const h of hb2024) {
    if (!chart1Map[h.retailer]) chart1Map[h.retailer] = {}
    chart1Map[h.retailer][h.contract_type] =
      (chart1Map[h.retailer][h.contract_type] ?? 0) + h.hedge_volume_gwh
  }
  const chart1Data = RETAILERS.map(retailer => {
    const row: Record<string, string | number> = { retailer: retailer.replace(' Energy', '').replace('Australia', 'Aus') }
    for (const ct of CONTRACT_TYPES) {
      row[ct] = Math.round((chart1Map[retailer]?.[ct] ?? 0) * 10) / 10
    }
    return row
  })

  // ── Chart 2: Line — mtm_value_m by quarter per retailer (2024) ───────────
  const mtmByRetailerQ: Record<string, Record<number, number>> = {}
  for (const retailer of RETAILERS) mtmByRetailerQ[retailer] = {}
  for (const h of hb2024) {
    mtmByRetailerQ[h.retailer][h.quarter] =
      (mtmByRetailerQ[h.retailer][h.quarter] ?? 0) + h.mtm_value_m
  }
  const chart2Data = [1, 2, 3, 4].map(q => {
    const row: Record<string, string | number> = { quarter: `Q${q}` }
    for (const retailer of RETAILERS) {
      row[retailer] = Math.round((mtmByRetailerQ[retailer]?.[q] ?? 0) * 100) / 100
    }
    return row
  })

  // ── Chart 3: Bar — exposure_m by counterparty (summed, coloured by credit_rating) ──
  const cpExposureMap: Record<string, { exposure_m: number; credit_rating: string }> = {}
  for (const ce of counterparty_exposure) {
    if (!cpExposureMap[ce.counterparty]) {
      cpExposureMap[ce.counterparty] = { exposure_m: 0, credit_rating: ce.credit_rating }
    }
    cpExposureMap[ce.counterparty].exposure_m += ce.exposure_m
  }
  const chart3Data = Object.entries(cpExposureMap)
    .map(([cp, d]) => ({
      counterparty: cp.replace(' Energy', '').replace('Commonwealth ', 'CBA'),
      exposure_m: Math.round(d.exposure_m * 100) / 100,
      credit_rating: d.credit_rating,
    }))
    .sort((a, b) => b.exposure_m - a.exposure_m)

  // ── Chart 4: Line — spot_price_volatility_pct by quarter for each region (2024) ──
  const volByRegionQ: Record<string, Record<number, number>> = {}
  for (const region of REGIONS) volByRegionQ[region] = {}
  for (const vm of volatility_metrics) {
    if (vm.year === 2024) {
      volByRegionQ[vm.region][vm.quarter] = vm.spot_price_volatility_pct
    }
  }
  const chart4Data = [1, 2, 3, 4].map(q => {
    const row: Record<string, string | number> = { quarter: `Q${q}` }
    for (const region of REGIONS) {
      row[region] = volByRegionQ[region]?.[q] ?? 0
    }
    return row
  })

  // ── Chart 5: Grouped bar — avg pnl_impact_m by scenario × region (stress tests) ──
  const stressByScenarioRegion: Record<string, Record<string, number[]>> = {}
  for (const scenario of SCENARIOS) {
    stressByScenarioRegion[scenario] = {}
    for (const region of REGIONS) stressByScenarioRegion[scenario][region] = []
  }
  for (const st of stress_tests) {
    if (stressByScenarioRegion[st.scenario]) {
      stressByScenarioRegion[st.scenario][st.region]?.push(st.pnl_impact_m)
    }
  }
  const chart5Data = SCENARIOS.map(scenario => {
    const row: Record<string, string | number> = {
      scenario: scenario.length > 18 ? scenario.slice(0, 16) + '…' : scenario,
    }
    for (const region of REGIONS) {
      const vals = stressByScenarioRegion[scenario][region] ?? []
      row[region] = vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : 0
    }
    return row
  })

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="text-blue-400" size={26} />
        <div>
          <h1 className="text-xl font-bold text-white">Energy Retailer Hedging Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Hedge book, counterparty exposure, hedging costs, volatility metrics and stress test analytics
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Hedge Book Value (MTM)"
          value={`$${summary.total_hedge_book_value_m.toFixed(1)}`}
          unit="M"
          sub="Mark-to-market AUD"
        />
        <KpiCard
          label="Avg Hedge Ratio"
          value={String(summary.avg_hedge_ratio_pct)}
          unit="%"
          sub="% of load hedged"
        />
        <KpiCard
          label="Total Counterparty Exposure"
          value={`$${summary.total_counterparty_exposure_m.toFixed(1)}`}
          unit="M"
          sub="Current credit exposure"
        />
        <KpiCard
          label="Avg Hedging Cost"
          value={`$${summary.avg_hedging_cost_aud_mwh.toFixed(2)}`}
          unit="/MWh"
          sub="Effective cost per MWh"
        />
        <KpiCard
          label="Max VaR 95%"
          value={`$${summary.max_var_95_m.toFixed(2)}`}
          unit="M"
          sub="95% confidence VaR"
        />
      </div>

      {/* Chart 1: Stacked bar — hedge_volume_gwh by retailer × contract_type (2024) */}
      <ChartSection title="Chart 1 — Hedge Volume (GWh) by Retailer and Contract Type — 2024">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 4, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="retailer" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" GWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`${v.toFixed(1)} GWh`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {CONTRACT_TYPES.map(ct => (
              <Bar key={ct} dataKey={ct} stackId="a" fill={CONTRACT_COLOURS[ct]} name={ct} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 2: Line — MTM value by quarter per retailer (2024) */}
      <ChartSection title="Chart 2 — Mark-to-Market Value ($M) by Quarter per Retailer — 2024">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart2Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {RETAILERS.map(retailer => (
              <Line
                key={retailer}
                type="monotone"
                dataKey={retailer}
                stroke={RETAILER_COLOURS[retailer]}
                strokeWidth={2}
                dot={{ r: 4 }}
                name={retailer}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 3: Bar — exposure_m by counterparty (coloured by credit_rating) */}
      <ChartSection title="Chart 3 — Counterparty Exposure ($M) — All Retailers Summed, Coloured by Credit Rating">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart3Data} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="counterparty"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number, _name: string, props: { payload?: { credit_rating?: string } }) => [
                `$${v.toFixed(2)}M`,
                `Rating: ${props.payload?.credit_rating ?? 'N/A'}`,
              ]}
            />
            <Bar dataKey="exposure_m" radius={[4, 4, 0, 0]} name="Exposure ($M)">
              {chart3Data.map((entry, idx) => (
                <Cell key={idx} fill={RATING_COLOURS[entry.credit_rating] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 flex-wrap">
          {Object.entries(RATING_COLOURS).map(([rating, colour]) => (
            <span key={rating} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
              {rating}
            </span>
          ))}
        </div>
      </ChartSection>

      {/* Chart 4: Line — spot_price_volatility_pct by quarter for each region (2024) */}
      <ChartSection title="Chart 4 — Spot Price Volatility (%) by Quarter per Region — 2024">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart4Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {REGIONS.map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region]}
                strokeWidth={2}
                dot={{ r: 4 }}
                name={region}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 5: Grouped bar — avg pnl_impact_m by scenario × region */}
      <ChartSection title="Chart 5 — Avg P&L Impact ($M) by Stress Scenario and Region">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart5Data} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="scenario"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {REGIONS.map(region => (
              <Bar
                key={region}
                dataKey={region}
                fill={REGION_COLOURS[region]}
                radius={[3, 3, 0, 0]}
                name={region}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Summary Grid */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Dashboard Summary</h3>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Hedge Book Value (MTM)', value: `$${summary.total_hedge_book_value_m.toFixed(2)}M` },
            { label: 'Avg Hedge Ratio', value: `${summary.avg_hedge_ratio_pct}%` },
            { label: 'Total Counterparty Exposure', value: `$${summary.total_counterparty_exposure_m.toFixed(2)}M` },
            { label: 'Avg Hedging Cost', value: `$${summary.avg_hedging_cost_aud_mwh.toFixed(2)}/MWh` },
            { label: 'Max VaR 95%', value: `$${summary.max_var_95_m.toFixed(2)}M` },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="text-sm font-semibold text-gray-100 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
