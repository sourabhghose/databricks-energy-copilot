// Sprint 57c — Carbon Border Adjustment Mechanism (CBAM) &
//              Australian Export Trade Analytics

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
} from 'recharts'
import { Globe } from 'lucide-react'
import { getCbamTradeDashboard, CbamTradeDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const SECTOR_COLOURS: Record<string, string> = {
  ALUMINIUM:        '#60a5fa',
  STEEL:            '#34d399',
  CEMENT:           '#a78bfa',
  CHEMICALS:        '#fbbf24',
  LNG:              '#f87171',
  CLEAN_HYDROGEN:   '#2dd4bf',
  GREEN_AMMONIA:    '#4ade80',
  BATTERY_MATERIALS:'#fb923c',
}

const STATUS_STYLE: Record<string, string> = {
  ENACTED:      'bg-green-900 text-green-300 border border-green-700',
  PROPOSED:     'bg-amber-900 text-amber-300 border border-amber-700',
  UNDER_REVIEW: 'bg-blue-900 text-blue-300 border border-blue-700',
}

const COUNTRY_FLAG: Record<string, string> = {
  'European Union': '🇪🇺',
  'United Kingdom': '🇬🇧',
  'United States':  '🇺🇸',
  'Canada':         '🇨🇦',
  'Japan':          '🇯🇵',
}

const PARTNER_COLOURS = [
  '#60a5fa','#34d399','#fbbf24','#f87171','#a78bfa',
  '#2dd4bf','#4ade80','#fb923c','#e879f9','#38bdf8',
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  colour: string
}

function KpiCard({ label, value, sub, colour }: KpiCardProps) {
  return (
    <div className={`rounded-xl border ${colour} p-4 flex flex-col gap-1`}>
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom scatter tooltip
// ---------------------------------------------------------------------------

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs text-gray-200 shadow-lg space-y-1">
      <p className="font-semibold text-white">{d.trading_partner}</p>
      <p>Sector: <span className="text-blue-300">{d.sector}</span></p>
      <p>CBAM Tariff: <span className="text-amber-300">{d.cbam_tariff_rate_pct}%</span></p>
      <p>Embedded Carbon: <span className="text-red-300">{d.embedded_carbon_kt_co2.toLocaleString()} kt CO₂</span></p>
      <p>Export Volume: <span className="text-green-300">{d.export_volume_kt.toLocaleString()} kt</span></p>
      <p>CBAM Cost: <span className="text-orange-300">A${d.cbam_cost_m_aud}M</span></p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CbamTradeAnalytics() {
  const [data, setData] = useState<CbamTradeDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCbamTradeDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading CBAM Trade Analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error loading data: {error}
      </div>
    )
  }

  // ---- KPI derivations ----
  const totalCbamExposure = data.export_sectors
    .reduce((sum, s) => sum + s.cbam_exposure_m_aud, 0)

  const largestSector = data.export_sectors
    .reduce((a, b) => (a.cbam_exposure_m_aud >= b.cbam_exposure_m_aud ? a : b))

  const cleanExportOpportunity = data.clean_exports
    .reduce((sum, c) => sum + c.market_size_bn_aud, 0)

  const enactedPolicies = data.policies.filter(p => p.policy_status === 'ENACTED').length

  // ---- Scatter data with partner colours ----
  const partnerList = Array.from(new Set(data.trade_flows.map(f => f.trading_partner)))
  const scatterByPartner = partnerList.map((partner, idx) => ({
    name: partner,
    colour: PARTNER_COLOURS[idx % PARTNER_COLOURS.length],
    points: data.trade_flows
      .filter(f => f.trading_partner === partner)
      .map(f => ({ ...f })),
  }))

  // ---- Clean export bar data ----
  const cleanBarData = data.clean_exports.map(c => ({
    name: c.product.replace(/_/g, ' '),
    'Production Cost': Math.round(c.production_cost_aud_tonne),
    'Target Price': Math.round(c.target_price_aud_tonne),
    market_size: c.market_size_bn_aud,
  }))

  return (
    <div className="p-6 space-y-8 text-gray-100 min-h-screen bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            CBAM & Australian Export Trade Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Carbon Border Adjustment Mechanism exposure, clean export opportunities,
            and embedded carbon in Australian exports
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total CBAM Exposure"
          value={`A$${totalCbamExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}M`}
          sub="Across all exposed sectors"
          colour="border-red-700"
        />
        <KpiCard
          label="Largest Exposed Sector"
          value={largestSector.sector.replace(/_/g, ' ')}
          sub={`A$${largestSector.cbam_exposure_m_aud.toLocaleString()}M exposure`}
          colour="border-amber-700"
        />
        <KpiCard
          label="Clean Export Opportunity"
          value={`A$${cleanExportOpportunity.toFixed(0)}B`}
          sub="Total addressable market size"
          colour="border-green-700"
        />
        <KpiCard
          label="Enacted CBAM Policies"
          value={String(enactedPolicies)}
          sub="Countries with live carbon border tariffs"
          colour="border-blue-700"
        />
      </div>

      {/* Export Sector Exposure Table */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Export Sector CBAM Exposure
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-300 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Sector</th>
                <th className="px-4 py-3 text-right">Export Value (bn AUD)</th>
                <th className="px-4 py-3 text-right">Carbon Intensity (tCO₂/t)</th>
                <th className="px-4 py-3 text-right">CBAM Exposure (M AUD)</th>
                <th className="px-4 py-3 text-center">Clean Alternative</th>
                <th className="px-4 py-3 text-right">Transition (yrs)</th>
                <th className="px-4 py-3 text-left">Competitive Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.export_sectors
                .slice()
                .sort((a, b) => b.cbam_exposure_m_aud - a.cbam_exposure_m_aud)
                .map(s => (
                  <tr
                    key={s.sector}
                    className="bg-gray-900 hover:bg-gray-800 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                        style={{ backgroundColor: SECTOR_COLOURS[s.sector] ?? '#6b7280' }}
                      />
                      {s.sector.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-300">
                      {s.export_value_bn_aud.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-300">
                      {s.carbon_intensity_tco2_per_tonne.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          s.cbam_exposure_m_aud > 500
                            ? 'text-red-400'
                            : s.cbam_exposure_m_aud > 100
                            ? 'text-amber-400'
                            : 'text-green-400'
                        }`}
                      >
                        {s.cbam_exposure_m_aud === 0
                          ? 'Nil'
                          : `${s.cbam_exposure_m_aud.toLocaleString()}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.clean_alternative_available ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-900 text-green-300 border border-green-700">
                          Available
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-400 border border-gray-600">
                          Not Yet
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {s.transition_timeline_years === 0 ? 'Ready' : s.transition_timeline_years}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs">
                      {s.australian_competitive_advantage}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Trade Flow Bubble Chart */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">
          Trade Flow Exposure — CBAM Tariff vs Embedded Carbon
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Bubble size = export volume (kt). X-axis = CBAM tariff rate (%), Y-axis = embedded carbon (kt CO₂).
        </p>
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="cbam_tariff_rate_pct"
                type="number"
                name="CBAM Tariff"
                unit="%"
                label={{ value: 'CBAM Tariff Rate (%)', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 12 }}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                domain={[0, 7]}
              />
              <YAxis
                dataKey="embedded_carbon_kt_co2"
                type="number"
                name="Embedded Carbon"
                unit=" kt"
                label={{ value: 'Embedded Carbon (kt CO₂)', angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af', fontSize: 12 }}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <ZAxis
                dataKey="export_volume_kt"
                type="number"
                range={[40, 600]}
                name="Export Volume"
              />
              <Tooltip content={<ScatterTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#9ca3af', paddingTop: '8px' }}
              />
              {scatterByPartner.map(({ name, colour, points }) => (
                <Scatter
                  key={name}
                  name={name}
                  data={points}
                  fill={colour}
                  fillOpacity={0.75}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Clean Export Opportunity Bar Chart */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1">
          Clean Export Opportunity — Production Cost vs Target Price
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          AUD per tonne. Market size (bn AUD) shown as tooltip annotation.
        </p>
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={cleanBarData} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                label={{ value: 'AUD / tonne', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(value: number, name: string, props: any) => {
                  const ms = props.payload?.market_size
                  const suffix = ms ? ` (Market: A$${ms}B)` : ''
                  return [`A$${value.toLocaleString()}${name === 'Production Cost' ? suffix : ''}`, name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="Production Cost" fill="#f87171" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Target Price" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Clean Export Product Cards */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Clean Export Products — Market Detail
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.clean_exports
            .slice()
            .sort((a, b) => a.competitiveness_rank - b.competitiveness_rank)
            .map(c => {
              const costGap = c.production_cost_aud_tonne - c.target_price_aud_tonne
              const competitive = costGap <= 0
              return (
                <div
                  key={c.product}
                  className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">
                      {c.product.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300 border border-blue-700">
                      Rank #{c.competitiveness_rank}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-gray-400">Production Cost</span>
                    <span className="text-right text-red-300">
                      A${c.production_cost_aud_tonne.toLocaleString()}/t
                    </span>
                    <span className="text-gray-400">Target Price</span>
                    <span className="text-right text-green-300">
                      A${c.target_price_aud_tonne.toLocaleString()}/t
                    </span>
                    <span className="text-gray-400">Cost Gap</span>
                    <span
                      className={`text-right font-semibold ${
                        competitive ? 'text-green-400' : 'text-amber-400'
                      }`}
                    >
                      {competitive
                        ? `–A$${Math.abs(costGap).toLocaleString()}/t`
                        : `+A$${costGap.toLocaleString()}/t`}
                    </span>
                    <span className="text-gray-400">Market Size</span>
                    <span className="text-right text-blue-300">A${c.market_size_bn_aud}B</span>
                    <span className="text-gray-400">2030 Target</span>
                    <span className="text-right text-purple-300">
                      {c.target_2030_kt.toLocaleString()} kt
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Key Markets: </span>
                    <span className="text-xs text-gray-200">{c.key_markets.join(', ')}</span>
                  </div>
                </div>
              )
            })}
        </div>
      </section>

      {/* Policy Tracker Table */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Global CBAM Policy Tracker</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-300 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Country</th>
                <th className="px-4 py-3 text-left">Policy</th>
                <th className="px-4 py-3 text-right">Carbon Price (AUD/t)</th>
                <th className="px-4 py-3 text-right">Implementation</th>
                <th className="px-4 py-3 text-left">Sectors Covered</th>
                <th className="px-4 py-3 text-right">AU Exposure (M AUD)</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.policies
                .slice()
                .sort((a, b) => b.australia_exposure_m_aud - a.australia_exposure_m_aud)
                .map(p => (
                  <tr
                    key={p.country}
                    className="bg-gray-900 hover:bg-gray-800 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      <span className="mr-2 text-base">
                        {COUNTRY_FLAG[p.country] ?? '🌐'}
                      </span>
                      {p.country}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs max-w-xs">
                      {p.policy_name}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-300 font-semibold">
                      A${p.carbon_price_aud_tonne}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {p.implementation_year}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {p.sectors_covered.join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          p.australia_exposure_m_aud > 1000
                            ? 'text-red-400'
                            : p.australia_exposure_m_aud > 300
                            ? 'text-amber-400'
                            : 'text-yellow-300'
                        }`}
                      >
                        {p.australia_exposure_m_aud.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_STYLE[p.policy_status] ?? 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {p.policy_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-gray-600 pt-2">
        Data as of {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST.
        CBAM exposure estimates are indicative and based on 2025 trade flows and carbon prices.
      </p>
    </div>
  )
}
