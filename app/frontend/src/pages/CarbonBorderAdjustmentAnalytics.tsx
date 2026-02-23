import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ZAxis,
} from 'recharts'
import { Globe } from 'lucide-react'
import {
  getCarbonBorderAdjustmentDashboard,
  CBAMDashboard,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const RISK_COLOURS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f59e0b',
  Low:    '#22c55e',
}

const JURISDICTION_COLOURS: Record<string, string> = {
  'EU ETS':                '#6366f1',
  'Australia Safeguard':   '#22c55e',
  'UK ETS':                '#f59e0b',
  'US Carbon Price':       '#22d3ee',
  'Global Average':        '#a78bfa',
}

const PARTNER_COLOURS: Record<string, string> = {
  EU:          '#6366f1',
  UK:          '#f59e0b',
  Japan:       '#22c55e',
  'South Korea': '#22d3ee',
  USA:         '#ef4444',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'No CBAM':              '#22c55e',
  'EU CBAM Only':         '#f59e0b',
  'Global CBAM':          '#ef4444',
  'Domestic Carbon Price': '#6366f1',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon }: {
  label: string; value: string; sub?: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
      <div className="p-3 bg-gray-700 rounded-lg">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CarbonBorderAdjustmentAnalytics() {
  const [data, setData] = useState<CBAMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCarbonBorderAdjustmentDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900">
        Loading Carbon Border Adjustment Mechanism Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 bg-gray-900">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  // ─── Chart 1: Bar — eu_cbam_liability_m by sector coloured by risk_level ──
  const sectorLiabilityMap: Record<string, { total: number; risk: string }> = {}
  data.exposed_sectors.forEach(s => {
    if (!sectorLiabilityMap[s.sector]) {
      sectorLiabilityMap[s.sector] = { total: 0, risk: s.risk_level }
    }
    sectorLiabilityMap[s.sector].total += s.eu_cbam_liability_m
  })
  const sectorBarData = Object.entries(sectorLiabilityMap).map(([sector, v]) => ({
    sector,
    eu_cbam_liability_m: Math.round(v.total * 10) / 10,
    risk_level: v.risk,
    fill: RISK_COLOURS[v.risk] ?? '#6b7280',
  }))

  // ─── Chart 2: Line — price_aud_per_tco2 by year for 5 jurisdictions ───────
  const yearsSet = new Set<number>()
  data.carbon_prices.forEach(cp => yearsSet.add(cp.year))
  const priceYears = Array.from(yearsSet).sort((a, b) => a - b)
  const jurisdictions = Object.keys(JURISDICTION_COLOURS)
  const carbonPriceLineData = priceYears.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    jurisdictions.forEach(j => {
      const rec = data.carbon_prices.find(cp => cp.year === yr && cp.jurisdiction === j)
      row[j] = rec ? Math.round(rec.price_aud_per_tco2 * 10) / 10 : 0
    })
    return row
  })

  // ─── Chart 3: Bar — total_annual_liability_m by trade_partner sorted desc ─
  const partnerLiabilityMap: Record<string, number> = {}
  data.trade_impacts.forEach(ti => {
    partnerLiabilityMap[ti.trade_partner] = (partnerLiabilityMap[ti.trade_partner] ?? 0) + ti.total_annual_liability_m
  })
  const partnerBarData = Object.entries(partnerLiabilityMap)
    .map(([partner, total]) => ({
      partner,
      total_annual_liability_m: Math.round(total * 10) / 10,
    }))
    .sort((a, b) => b.total_annual_liability_m - a.total_annual_liability_m)

  // ─── Chart 4: Scatter — cost_per_tco2 vs abatement_potential_mtco2, sized by investment_required_b ─
  const scatterData = data.abatement_options.map(ao => ({
    x: Math.round(ao.cost_per_tco2 * 10) / 10,
    y: Math.round(ao.abatement_potential_mtco2 * 10) / 10,
    z: Math.round(ao.investment_required_b * 10) / 10,
    name: ao.option_name,
    maturity: ao.maturity,
  }))

  // ─── Chart 5: Line — net_gdp_impact_m by year for 4 scenarios ─────────────
  const scenarioYearsSet = new Set<number>()
  data.policy_scenarios.forEach(ps => scenarioYearsSet.add(ps.year))
  const scenarioYears = Array.from(scenarioYearsSet).sort((a, b) => a - b)
  const scenarioNames = Object.keys(SCENARIO_COLOURS)
  const scenarioLineData = scenarioYears.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    scenarioNames.forEach(sc => {
      const rec = data.policy_scenarios.find(ps => ps.year === yr && ps.scenario === sc)
      row[sc] = rec ? Math.round(rec.net_gdp_impact_m * 10) / 10 : 0
    })
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Carbon Border Adjustment Mechanism Analytics</h1>
          <p className="text-sm text-gray-400">
            EU CBAM exposure, carbon price trajectories, trade impacts and decarbonisation pathways for Australian exports
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total EU CBAM Liability"
          value={`$${summary.total_eu_cbam_liability_m ?? '—'}M`}
          sub="Across all exposed sectors"
          Icon={Globe}
        />
        <KpiCard
          label="Highest Risk Sector"
          value={String(summary.highest_risk_sector ?? '—')}
          sub="By aggregate CBAM liability"
          Icon={Globe}
        />
        <KpiCard
          label="Avg Carbon Price Gap"
          value={`€${summary.avg_carbon_price_gap ?? '—'}/tCO₂`}
          sub="EU ETS minus AUS carbon cost"
          Icon={Globe}
        />
        <KpiCard
          label="Total Abatement Potential"
          value={`${summary.total_abatement_potential_mtco2 ?? '—'} MtCO₂`}
          sub="Across all abatement options"
          Icon={Globe}
        />
      </div>

      {/* Chart 1: EU CBAM Liability by Sector */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          EU CBAM Liability by Sector ($M) — Coloured by Risk Level
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={sectorBarData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $M" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value: number, _name: string, props: { payload?: { risk_level?: string } }) => [
                `$${value}M`,
                `Risk: ${props.payload?.risk_level ?? ''}`,
              ]}
            />
            <Bar dataKey="eu_cbam_liability_m" name="EU CBAM Liability ($M)">
              {sectorBarData.map((entry, index) => (
                <rect key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          {Object.entries(RISK_COLOURS).map(([risk, colour]) => (
            <span key={risk} className="flex items-center gap-1">
              <span style={{ background: colour }} className="inline-block w-3 h-3 rounded-sm" />
              {risk}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Carbon Price Trajectories by Jurisdiction */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Carbon Price Trajectories 2024–2035 (AUD/tCO₂)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={carbonPriceLineData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" AUD" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ paddingTop: 8 }} />
            {jurisdictions.map(j => (
              <Line
                key={j}
                type="monotone"
                dataKey={j}
                stroke={JURISDICTION_COLOURS[j] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={j}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Trade Liability by Partner */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Annual CBAM Liability by Trade Partner ($M) — Sorted Descending
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={partnerBarData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="partner" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $M" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="total_annual_liability_m" name="Total Liability ($M)" radius={[4, 4, 0, 0]}>
              {partnerBarData.map((entry, index) => (
                <rect key={`partner-cell-${index}`} fill={PARTNER_COLOURS[entry.partner] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Abatement Cost vs Potential Scatter */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Abatement Options: Cost (€/tCO₂) vs Potential (MtCO₂) — Dot size = Investment ($B)
        </h2>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="x"
              name="Cost (€/tCO₂)"
              unit=" €"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Cost €/tCO₂', position: 'insideBottom', offset: -4, fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis
              dataKey="y"
              name="Abatement Potential (MtCO₂)"
              unit=" Mt"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Potential MtCO₂', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 12 }}
            />
            <ZAxis dataKey="z" range={[60, 600]} name="Investment ($B)" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload || payload.length === 0) return null
                const d = payload[0].payload as { name: string; x: number; y: number; z: number; maturity: string }
                return (
                  <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-200 shadow-lg">
                    <p className="font-semibold mb-1">{d.name}</p>
                    <p>Cost: €{d.x}/tCO₂</p>
                    <p>Potential: {d.y} MtCO₂</p>
                    <p>Investment: ${d.z}B</p>
                    <p>Maturity: {d.maturity}</p>
                  </div>
                )
              }}
            />
            <Scatter data={scatterData} fill="#22d3ee" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Net GDP Impact by Scenario */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Net GDP Impact by Policy Scenario 2024–2035 ($M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={scenarioLineData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ paddingTop: 8 }} />
            {scenarioNames.map(sc => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLOURS[sc] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={sc}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Summary</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Total EU CBAM Liability</dt>
            <dd className="text-xl font-bold text-white mt-1">${summary.total_eu_cbam_liability_m ?? '—'}M</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Highest Risk Sector</dt>
            <dd className="text-xl font-bold text-red-400 mt-1">{String(summary.highest_risk_sector ?? '—')}</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Avg Carbon Price Gap</dt>
            <dd className="text-xl font-bold text-white mt-1">€{summary.avg_carbon_price_gap ?? '—'}/tCO₂</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Total Abatement Potential</dt>
            <dd className="text-xl font-bold text-white mt-1">{summary.total_abatement_potential_mtco2 ?? '—'} MtCO₂</dd>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 sm:col-span-2">
            <dt className="text-xs text-gray-400 uppercase tracking-wide">Recommended Action</dt>
            <dd className="text-sm font-medium text-cyan-300 mt-1">{String(summary.recommended_action ?? '—')}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
