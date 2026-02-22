import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Award } from 'lucide-react'
import {
  getLGCMarketDashboard,
  LGCADashboard,
  LGCAPriceRecord,
  LGCACreationRecord,
  LGCABankingRecord,
  LGCAScenarioRecord,
  LGCARegistrantRecord,
  LGCAObligationRecord,
} from '../api/client'

// ── colour palette ────────────────────────────────────────────────────────────
const COLOURS = {
  spot:    '#34d399',
  fwd2026: '#60a5fa',
  fwd2028: '#f59e0b',
  fwd2030: '#f472b6',
  solar:   '#fbbf24',
  wind:    '#34d399',
  hydro:   '#60a5fa',
  other:   '#a78bfa',
  banked:  '#34d399',
  supply:  '#60a5fa',
  demand:  '#f87171',
  current: '#34d399',
  retInc:  '#60a5fa',
  glut:    '#a78bfa',
  short:   '#f87171',
}

// ── tiny KPI card ─────────────────────────────────────────────────────────────
function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function LGCMarketAnalytics() {
  const [data, setData]     = useState<LGCADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    getLGCMarketDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 bg-gray-900">
      <p className="text-gray-400 animate-pulse text-lg">Loading LGC Market data…</p>
    </div>
  )
  if (error || !data) return (
    <div className="flex items-center justify-center h-64 bg-gray-900">
      <p className="text-red-400">Error: {error ?? 'No data returned'}</p>
    </div>
  )

  const { prices, creation_records, banking, scenarios, registrants, obligations, summary } = data

  // ── derived chart data ────────────────────────────────────────────────────
  const priceChartData = prices.map((p: LGCAPriceRecord) => ({
    month:   p.date.slice(0, 7),
    spot:    p.lgc_spot_price_aud,
    fwd2026: p.lgc_forward_2026_aud,
    fwd2028: p.lgc_forward_2028_aud,
    fwd2030: p.lgc_forward_2030_aud,
  }))

  const creationChartData = creation_records.map((c: LGCACreationRecord) => ({
    year:  c.year,
    solar: +(c.certificates_created_k * c.technology_solar_pct / 100).toFixed(1),
    wind:  +(c.certificates_created_k * c.technology_wind_pct  / 100).toFixed(1),
    hydro: +(c.certificates_created_k * c.technology_hydro_pct / 100).toFixed(1),
    other: +(c.certificates_created_k * c.technology_other_pct / 100).toFixed(1),
  }))

  const bankingChartData = banking.map((b: LGCABankingRecord) => ({
    year:   b.year,
    banked: b.total_banked_certificates_m,
    supply: +(b.new_banking_k / 1000).toFixed(3),
    demand: +(b.surrenders_for_compliance_k / 1000).toFixed(3),
  }))

  const scenarioChartData = Array.from(new Set(scenarios.map((s: LGCAScenarioRecord) => s.year)))
    .sort()
    .map(yr => {
      const row: Record<string, number | string> = { year: yr }
      scenarios.filter((s: LGCAScenarioRecord) => s.year === yr).forEach((s: LGCAScenarioRecord) => {
        const key = s.scenario_name.replace(/\s+/g, '_')
        row[key] = s.lgc_price_aud
      })
      return row
    })

  // top 10 registrants by certificates pa
  const topRegistrants = [...registrants]
    .sort((a: LGCARegistrantRecord, b: LGCARegistrantRecord) => b.certificates_pa_k - a.certificates_pa_k)
    .slice(0, 10)

  // obligation summary by entity type (2024)
  const obligationSummary = obligations
    .filter((o: LGCAObligationRecord) => o.acquisition_year === 2024)

  const fmt = (n: number, dp = 1) => n.toFixed(dp)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Award className="w-8 h-8 text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">LGC Market Analytics</h1>
          <p className="text-gray-400 text-sm">Large-Scale Generation Certificate Market — Australia</p>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Current Spot Price"
          value={`$${fmt(summary.current_spot_price_aud as number, 2)}`}
          sub="AUD / certificate"
        />
        <KPICard
          label="Registered Capacity"
          value={`${fmt(summary.total_registered_capacity_gw as number, 2)} GW`}
          sub="Accredited stations"
        />
        <KPICard
          label="Annual Creation"
          value={`${fmt(summary.annual_creation_k as number, 0)} k`}
          sub="Certificates created (2024)"
        />
        <KPICard
          label="Projected 2030 Price"
          value={`$${fmt(summary.projected_2030_price_aud as number, 2)}`}
          sub="Current Policy scenario"
        />
      </div>

      {/* ── LGC Spot & Forward Prices ──────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">LGC Spot &amp; Forward Prices (AUD)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} interval={3} />
            <YAxis stroke="#9ca3af" tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, undefined]}
            />
            <Legend />
            <Line type="monotone" dataKey="spot"    name="Spot"         stroke={COLOURS.spot}    dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="fwd2026" name="Forward 2026" stroke={COLOURS.fwd2026} dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="fwd2028" name="Forward 2028" stroke={COLOURS.fwd2028} dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="fwd2030" name="Forward 2030" stroke={COLOURS.fwd2030} dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Certificate Creation by Technology ─────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Certificate Creation by Technology (k certificates)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={creationChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [`${v.toFixed(0)} k`, undefined]}
            />
            <Legend />
            <Bar dataKey="solar" name="Solar" stackId="a" fill={COLOURS.solar} />
            <Bar dataKey="wind"  name="Wind"  stackId="a" fill={COLOURS.wind}  />
            <Bar dataKey="hydro" name="Hydro" stackId="a" fill={COLOURS.hydro} />
            <Bar dataKey="other" name="Other" stackId="a" fill={COLOURS.other} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Banking Levels & Supply-Demand ─────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Banking Levels &amp; Supply-Demand Balance</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={bankingChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            />
            <Legend />
            <Line type="monotone" dataKey="banked" name="Total Banked (M)" stroke={COLOURS.banked} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="supply" name="New Supply (M)"   stroke={COLOURS.supply} dot={false} strokeWidth={1.5} strokeDasharray="5 2" />
            <Line type="monotone" dataKey="demand" name="Compliance Demand (M)" stroke={COLOURS.demand} dot={false} strokeWidth={1.5} strokeDasharray="5 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Scenario Price Paths 2026-2030 ─────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Scenario Price Paths 2026–2030 (AUD / certificate)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={scenarioChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, undefined]}
            />
            <Legend />
            <Line type="monotone" dataKey="Current_Policy" name="Current Policy"  stroke={COLOURS.current} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="RET_Increase"   name="RET Increase"    stroke={COLOURS.retInc}  dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="Supply_Glut"    name="Supply Glut"     stroke={COLOURS.glut}    dot={false} strokeWidth={2} strokeDasharray="6 2" />
            <Line type="monotone" dataKey="Supply_Shortage" name="Supply Shortage" stroke={COLOURS.short}  dot={false} strokeWidth={2} strokeDasharray="6 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Two-column tables ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Top Registrants */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Top 10 Registrants by Certificate Volume</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700 text-left">
                  <th className="pb-2 pr-3">Station</th>
                  <th className="pb-2 pr-3">Tech</th>
                  <th className="pb-2 pr-3">State</th>
                  <th className="pb-2 pr-3">Cap (MW)</th>
                  <th className="pb-2 pr-3">Certs/yr (k)</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {topRegistrants.map((r: LGCARegistrantRecord) => (
                  <tr key={r.registrant_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-3 text-white font-medium truncate max-w-[140px]">{r.station_name}</td>
                    <td className="py-2 pr-3 text-gray-300">{r.technology}</td>
                    <td className="py-2 pr-3 text-gray-300">{r.state}</td>
                    <td className="py-2 pr-3 text-gray-300">{r.accredited_capacity_mw.toFixed(0)}</td>
                    <td className="py-2 pr-3 text-emerald-400 font-medium">{r.certificates_pa_k.toFixed(1)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === 'Active'    ? 'bg-emerald-900/50 text-emerald-400' :
                        r.status === 'Suspended' ? 'bg-yellow-900/50 text-yellow-400' :
                                                    'bg-red-900/50 text-red-400'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Obligation Compliance */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Obligation Compliance Summary (2024)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700 text-left">
                  <th className="pb-2 pr-3">Entity</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Required (k)</th>
                  <th className="pb-2 pr-3">Acquired (k)</th>
                  <th className="pb-2 pr-3">Shortfall (k)</th>
                  <th className="pb-2">Compliance %</th>
                </tr>
              </thead>
              <tbody>
                {obligationSummary.map((o: LGCAObligationRecord) => (
                  <tr key={o.obligation_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-3 text-white font-medium">{o.entity_name}</td>
                    <td className="py-2 pr-3 text-gray-300">{o.liable_entity_type}</td>
                    <td className="py-2 pr-3 text-gray-300">{o.required_certificates_k.toFixed(0)}</td>
                    <td className="py-2 pr-3 text-gray-300">{o.acquired_certificates_k.toFixed(0)}</td>
                    <td className="py-2 pr-3">
                      <span className={o.shortfall_certificates_k > 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {o.shortfall_certificates_k.toFixed(0)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`font-semibold ${
                        o.compliance_pct >= 95 ? 'text-emerald-400' :
                        o.compliance_pct >= 80 ? 'text-yellow-400' :
                                                   'text-red-400'
                      }`}>
                        {o.compliance_pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
