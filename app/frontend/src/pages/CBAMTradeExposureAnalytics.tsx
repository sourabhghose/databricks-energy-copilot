// Sprint 78c — Carbon Border Adjustment Mechanism (CBAM) & Trade Exposure Analytics
// Covers Australia's trade-exposed industries, EU CBAM impacts, carbon leakage risks,
// and Australian industrial competitiveness.

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts'
import { Globe, AlertTriangle, TrendingDown, Factory, Shield } from 'lucide-react'
import {
  getCBAMTradeExposureDashboard,
  CBATEDashboard,
  CBATESectorRecord,
  CBATETradeFlowRecord,
  CBATECarbonLeakageRecord,
  CBATECompetitivenessRecord,
  CBATEPolicyScenarioRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour constants
// ---------------------------------------------------------------------------

const SECTOR_COLOURS: Record<string, string> = {
  STEEL:      '#60a5fa',
  ALUMINIUM:  '#34d399',
  CEMENT:     '#a78bfa',
  FERTILISER: '#fbbf24',
  CHEMICALS:  '#f97316',
  MINING:     '#e879f9',
  LNG:        '#f87171',
  COAL:       '#94a3b8',
}

const DEST_COLOURS: Record<string, string> = {
  EU:          '#60a5fa',
  ASIA:        '#34d399',
  USA:         '#fbbf24',
  MIDDLE_EAST: '#f97316',
  DOMESTIC:    '#94a3b8',
}

const SCENARIO_COLOURS: Record<string, string> = {
  BASELINE:              '#94a3b8',
  AUS_CBAM:              '#60a5fa',
  GLOBAL_CARBON_PRICE:   '#f87171',
  ACCELERATED_SAFEGUARD: '#fbbf24',
  GREEN_DEAL_ALIGNMENT:  '#34d399',
}

const IMPACT_STYLE: Record<string, string> = {
  HIGH:   'bg-red-900 text-red-300 border border-red-700',
  MEDIUM: 'bg-amber-900 text-amber-300 border border-amber-700',
  LOW:    'bg-green-900 text-green-300 border border-green-700',
}

const RISK_STYLE: Record<string, string> = {
  HIGH:   'bg-red-900 text-red-300 border border-red-700',
  MEDIUM: 'bg-amber-900 text-amber-300 border border-amber-700',
  LOW:    'bg-green-900 text-green-300 border border-green-700',
}

const POLICY_LABEL: Record<string, string> = {
  REBATE:                  'Safeguard Rebate',
  EXEMPTION:               'EITE Exemption',
  INTERNATIONAL_AGREEMENT: 'Intl Agreement',
  CBAM_EQUIVALENT:         'CBAM Equivalent',
}

const SCENARIO_LABEL: Record<string, string> = {
  BASELINE:              'Baseline',
  AUS_CBAM:              'Aus CBAM',
  GLOBAL_CARBON_PRICE:   'Global Carbon Price',
  ACCELERATED_SAFEGUARD: 'Accelerated Safeguard',
  GREEN_DEAL_ALIGNMENT:  'Green Deal Alignment',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title, value, unit, sub, icon: Icon, colour,
}: {
  title: string; value: string | number; unit?: string; sub?: string;
  icon: React.ElementType; colour: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide">
        <Icon size={14} className={colour} />
        {title}
      </div>
      <div className="text-2xl font-bold text-white">
        {value}
        {unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Sector CBAM Exposure BarChart
// ---------------------------------------------------------------------------

function SectorExposureChart({ sectors }: { sectors: CBATESectorRecord[] }) {
  const data = [...sectors].sort((a, b) => b.annual_cbam_cost_m - a.annual_cbam_cost_m)
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          formatter={(v: number) => [`$${v.toFixed(0)}M`, 'Annual CBAM Cost']}
        />
        <Bar dataKey="annual_cbam_cost_m" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.sector} fill={SECTOR_COLOURS[d.sector] ?? '#60a5fa'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Trade Flows stacked BarChart (by destination)
// ---------------------------------------------------------------------------

function TradeFlowsChart({ flows }: { flows: CBATETradeFlowRecord[] }) {
  const sectors = Array.from(new Set(flows.map((f) => f.sector)))
  const destinations = ['EU', 'ASIA', 'USA', 'MIDDLE_EAST', 'DOMESTIC']

  const data = sectors.map((sec) => {
    const row: Record<string, number | string> = { sector: sec }
    for (const dest of destinations) {
      const match = flows.find((f) => f.sector === sec && f.destination === dest)
      row[dest] = match ? Math.round(match.export_value_m) : 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          formatter={(v: number) => [`$${v}M`]}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        {destinations.map((dest) => (
          <Bar key={dest} dataKey={dest} stackId="a" fill={DEST_COLOURS[dest]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Carbon Leakage Risk table
// ---------------------------------------------------------------------------

function LeakageRiskTable({ risks }: { risks: CBATECarbonLeakageRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th className="pb-2 pr-4">Sector</th>
            <th className="pb-2 pr-4">Risk</th>
            <th className="pb-2 pr-4">Leakage Rate</th>
            <th className="pb-2 pr-4">Policy Mechanism</th>
            <th className="pb-2 pr-4">Effectiveness</th>
            <th className="pb-2">Residual Leakage</th>
          </tr>
        </thead>
        <tbody>
          {risks.map((r) => (
            <tr key={r.sector} className="border-b border-gray-750 hover:bg-gray-750">
              <td className="py-2 pr-4 font-medium text-gray-200">{r.sector}</td>
              <td className="py-2 pr-4">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RISK_STYLE[r.leakage_risk]}`}>
                  {r.leakage_risk}
                </span>
              </td>
              <td className="py-2 pr-4 text-amber-300">{r.leakage_rate_pct.toFixed(1)}%</td>
              <td className="py-2 pr-4 text-gray-400 text-xs">
                {POLICY_LABEL[r.policy_mechanism] ?? r.policy_mechanism}
              </td>
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${r.effectiveness_score * 10}%` }}
                    />
                  </div>
                  <span className="text-gray-300 text-xs">{r.effectiveness_score.toFixed(1)}</span>
                </div>
              </td>
              <td className="py-2 text-red-300">{r.residual_leakage_pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Competitiveness Gap grouped BarChart (Aus vs competitors, by sector)
// ---------------------------------------------------------------------------

function CompetitivenessChart({ records }: { records: CBATECompetitivenessRecord[] }) {
  const sectors = Array.from(new Set(records.map((r) => r.sector)))
  const countries = ['CHINA', 'INDIA', 'SOUTH_KOREA']
  const COUNTRY_COLOURS = { CHINA: '#f87171', INDIA: '#fbbf24', SOUTH_KOREA: '#60a5fa' }

  const data = sectors.map((sec) => {
    const row: Record<string, number | string> = { sector: sec }
    for (const cc of countries) {
      const match = records.find((r) => r.sector === sec && r.competitor_country === cc)
      row[`gap_${cc}`] = match ? match.competitiveness_gap_pct : 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          unit="%"
          label={{ value: 'Cost Gap %', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          formatter={(v: number, name: string) => [
            `${v.toFixed(1)}%`,
            name.replace('gap_', '').replace('_', ' '),
          ]}
        />
        <Legend
          formatter={(v) => v.replace('gap_', '').replace('_', ' ')}
          wrapperStyle={{ color: '#9ca3af', fontSize: 11 }}
        />
        {countries.map((cc) => (
          <Bar
            key={cc}
            dataKey={`gap_${cc}`}
            fill={COUNTRY_COLOURS[cc as keyof typeof COUNTRY_COLOURS]}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Policy Scenarios LineChart (total carbon cost 2030)
// ---------------------------------------------------------------------------

function PolicyScenariosChart({ scenarios }: { scenarios: CBATEPolicyScenarioRecord[] }) {
  const sectorList = Array.from(new Set(scenarios.map((s) => s.sector)))
  const scenarioList = Array.from(new Set(scenarios.map((s) => s.scenario)))

  // Aggregate total carbon cost per scenario per sector for 2030
  const data = sectorList.map((sec) => {
    const row: Record<string, number | string> = { sector: sec }
    for (const sc of scenarioList) {
      const match = scenarios.find((s) => s.sector === sec && s.scenario === sc)
      row[sc] = match ? Math.round(match.total_carbon_cost_m) : 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          formatter={(v: number, name: string) => [
            `$${v}M`,
            SCENARIO_LABEL[name] ?? name,
          ]}
        />
        <Legend
          formatter={(v) => SCENARIO_LABEL[v] ?? v}
          wrapperStyle={{ color: '#9ca3af', fontSize: 11 }}
        />
        {scenarioList.map((sc) => (
          <Line
            key={sc}
            type="monotone"
            dataKey={sc}
            stroke={SCENARIO_COLOURS[sc] ?? '#60a5fa'}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Sector exposure table (detail)
// ---------------------------------------------------------------------------

function SectorDetailTable({ sectors }: { sectors: CBATESectorRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th className="pb-2 pr-4">Sector</th>
            <th className="pb-2 pr-4">Export Value</th>
            <th className="pb-2 pr-4">EU Export %</th>
            <th className="pb-2 pr-4">Carbon Intensity</th>
            <th className="pb-2 pr-4">Aus Carbon Price</th>
            <th className="pb-2 pr-4">EU ETS Price</th>
            <th className="pb-2 pr-4">CBAM Liability/t</th>
            <th className="pb-2 pr-4">Annual CBAM Cost</th>
            <th className="pb-2">Impact</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s) => (
            <tr key={s.sector} className="border-b border-gray-750 hover:bg-gray-750">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: SECTOR_COLOURS[s.sector] ?? '#60a5fa' }}
                  />
                  <span className="font-medium text-gray-200">{s.sector}</span>
                </div>
              </td>
              <td className="py-2 pr-4 text-gray-300">${s.annual_export_value_bn.toFixed(1)}B</td>
              <td className="py-2 pr-4 text-blue-300">{s.eu_export_pct.toFixed(1)}%</td>
              <td className="py-2 pr-4 text-gray-400">
                {s.carbon_intensity_t_per_t_product.toFixed(2)} tCO₂/t
              </td>
              <td className="py-2 pr-4 text-emerald-300">${s.aus_carbon_price_effective}/t</td>
              <td className="py-2 pr-4 text-amber-300">${s.eu_cbam_carbon_price}/t</td>
              <td className="py-2 pr-4 text-red-300">${s.cbam_liability_per_tonne.toFixed(1)}/t</td>
              <td className="py-2 pr-4 font-semibold text-white">${s.annual_cbam_cost_m}M</td>
              <td className="py-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${IMPACT_STYLE[s.competitiveness_impact]}`}>
                  {s.competitiveness_impact}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function CBAMTradeExposureAnalytics() {
  const [data, setData] = useState<CBATEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCBAMTradeExposureDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading CBAM Trade Exposure data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Unknown error'}
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe size={24} className="text-blue-400" />
        <div>
          <h1 className="text-xl font-bold text-white">
            CBAM &amp; Trade Exposure Analytics
          </h1>
          <p className="text-sm text-gray-400">
            EU Carbon Border Adjustment Mechanism impacts on Australian trade-exposed industries
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Total CBAM Exposure"
          value={`$${summary.total_cbam_exposure_m}`}
          unit="M/yr"
          sub="Across all sectors"
          icon={Globe}
          colour="text-blue-400"
        />
        <KpiCard
          title="Highest Risk Sector"
          value={String(summary.highest_risk_sector)}
          sub="Most exposed to CBAM"
          icon={AlertTriangle}
          colour="text-red-400"
        />
        <KpiCard
          title="EU Export % At Risk"
          value={`${summary.eu_export_pct_at_risk}`}
          unit="%"
          sub="Weighted avg EU share"
          icon={TrendingDown}
          colour="text-amber-400"
        />
        <KpiCard
          title="Avg Leakage Rate"
          value={`${summary.avg_leakage_rate_pct}`}
          unit="%"
          sub="Before policy intervention"
          icon={Factory}
          colour="text-purple-400"
        />
        <KpiCard
          title="Competitiveness Gap"
          value={`${summary.competitiveness_gap_pct_avg}`}
          unit="%"
          sub="Avg vs key competitors"
          icon={TrendingDown}
          colour="text-orange-400"
        />
        <KpiCard
          title="Best Scenario Abatement"
          value={`${summary.abatement_from_best_scenario_mt}`}
          unit="Mt CO₂"
          sub="Green Deal Alignment 2030"
          icon={Shield}
          colour="text-emerald-400"
        />
      </div>

      {/* Sector CBAM Exposure + detail table */}
      <Section title="Sector CBAM Exposure — Annual Cost by Sector">
        <SectorExposureChart sectors={data.sectors} />
        <div className="mt-6">
          <SectorDetailTable sectors={data.sectors} />
        </div>
      </Section>

      {/* Trade Flows */}
      <Section title="Export Trade Flows by Destination (A$M)">
        <TradeFlowsChart flows={data.trade_flows} />
      </Section>

      {/* Carbon Leakage Risk */}
      <Section title="Carbon Leakage Risk Assessment">
        <LeakageRiskTable risks={data.leakage_risks} />
      </Section>

      {/* Competitiveness Gap */}
      <Section title="Industrial Competitiveness Gap vs Key Competitors (% Cost Disadvantage)">
        <CompetitivenessChart records={data.competitiveness} />
        <p className="text-xs text-gray-500 mt-2">
          Positive values indicate Aus cost disadvantage (aus cost + carbon cost &gt; competitor total).
          Negative values indicate cost advantage.
        </p>
      </Section>

      {/* Policy Scenarios */}
      <Section title="Policy Scenario Carbon Costs by Sector — 2030 Projection (A$M)">
        <PolicyScenariosChart scenarios={data.policy_scenarios} />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(SCENARIO_LABEL).map(([key, label]) => (
            <div key={key} className="bg-gray-750 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: SCENARIO_COLOURS[key] }}
                />
                <span className="text-xs font-semibold text-gray-200">{label}</span>
              </div>
              <p className="text-xs text-gray-500">
                {key === 'BASELINE' && 'Current Safeguard trajectory, no new CBAM measures'}
                {key === 'AUS_CBAM' && 'Australia introduces domestic CBAM-equivalent border mechanism'}
                {key === 'GLOBAL_CARBON_PRICE' && 'Global carbon price alignment at $68/tCO₂ by 2030'}
                {key === 'ACCELERATED_SAFEGUARD' && 'Safeguard baselines tightened 6%/yr from 2026'}
                {key === 'GREEN_DEAL_ALIGNMENT' && 'Full EU Green Deal CBAM at A$95/tCO₂ from 2028'}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
