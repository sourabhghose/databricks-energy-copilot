import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Globe, Cable, DollarSign, Zap } from 'lucide-react'
import {
  getElectricityExportEconomicsDashboard,
  EXEDashboard,
  EXECableProjectRecord,
  EXECostBenefitRecord,
} from '../api/client'

// ─── Colour maps ──────────────────────────────────────────────────────────────
const STATUS_COLOURS: Record<string, string> = {
  OPERATIONAL:  'bg-green-600',
  CONSTRUCTION: 'bg-blue-600',
  APPROVED:     'bg-cyan-600',
  FEASIBILITY:  'bg-yellow-600',
  PROPOSED:     'bg-gray-500',
}

const TECH_COLOURS: Record<string, string> = {
  HVDC_SUBMARINE: 'bg-purple-600',
  HVAC_SUBMARINE: 'bg-indigo-600',
}

const LINE_COLOURS = ['#22d3ee', '#4ade80', '#f472b6', '#facc15', '#fb923c']

// ─── KPI card ────────────────────────────────────────────────────────────────
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

// ─── Badge helper ─────────────────────────────────────────────────────────────
function Badge({ label, colourClass }: { label: string; colourClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold text-white ${colourClass}`}>
      {label}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ElectricityExportEconomicsAnalytics() {
  const [data, setData] = useState<EXEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityExportEconomicsDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Loading Electricity Export Economics...</p>
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-red-400">Error: {error ?? 'No data'}</p>
    </div>
  )

  const summary = data.summary as Record<string, string | number>

  // ─── Energy flow chart: top 3 projects by capacity ─────────────────────────
  const top3Ids = data.cable_projects
    .slice()
    .sort((a, b) => b.capacity_gw - a.capacity_gw)
    .slice(0, 3)
    .map(p => p.project_id)

  const flowByYear: Record<number, Record<string, number>> = {}
  for (const flow of data.energy_flows) {
    if (!top3Ids.includes(flow.project_id)) continue
    if (!flowByYear[flow.year]) flowByYear[flow.year] = { year: flow.year }
    const proj = data.cable_projects.find(p => p.project_id === flow.project_id)
    const shortName = proj ? proj.name.split(' ').slice(0, 2).join(' ') : flow.project_id
    flowByYear[flow.year][shortName] = (flowByYear[flow.year][shortName] ?? 0) + flow.export_twh
  }
  const flowChartData = Object.values(flowByYear).sort((a, b) => (a.year as number) - (b.year as number))
  const top3Names = top3Ids.map(id => {
    const proj = data.cable_projects.find(p => p.project_id === id)
    return proj ? proj.name.split(' ').slice(0, 2).join(' ') : id
  })

  // ─── Market demand chart ────────────────────────────────────────────────────
  const demandChartData = data.market_demand.map(d => ({
    country: d.country,
    'Current (TWh)': d.current_import_twh,
    '2030 (TWh)': d.projected_2030_twh,
    '2040 (TWh)': d.projected_2040_twh,
  }))

  // ─── Supply zone chart ──────────────────────────────────────────────────────
  const supplyChartData = data.supply_zones.map(z => ({
    zone: z.zone.replace(' Zone', '').replace(' Solar', '').replace(' Hub', ''),
    'Solar GW': z.solar_potential_gw,
    'Wind GW': z.wind_potential_gw,
    'LCOE (AUD/MWh)': z.lcoe_aud_per_mwh,
  }))

  // ─── Cost benefit table: one row per project, base case ────────────────────
  const baseCaseCB: Record<string, EXECostBenefitRecord> = {}
  for (const cb of data.cost_benefits) {
    if (cb.scenario === 'Base Case') baseCaseCB[cb.project_id] = cb
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-8">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gray-800 rounded-xl">
          <Globe className="w-7 h-7 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Export Economics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australian submarine cable projects, HVDC to Asia and energy export hub economics
          </p>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Projects"
          value={String(summary.total_projects ?? data.cable_projects.length)}
          sub="Submarine cable proposals"
          Icon={Cable}
        />
        <KpiCard
          label="Total Capacity"
          value={`${summary.total_capacity_gw ?? '—'} GW`}
          sub="Combined export capacity"
          Icon={Zap}
        />
        <KpiCard
          label="Total CapEx"
          value={`A$${summary.total_capex_aud_bn ?? '—'} bn`}
          sub="Estimated capital cost"
          Icon={DollarSign}
        />
        <KpiCard
          label="Destination Countries"
          value={String(summary.destination_countries ?? data.market_demand.length)}
          sub="Asian import markets"
          Icon={Globe}
        />
      </div>

      {/* ─── Cable Project Table ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Cable Project Pipeline</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Project</th>
                <th className="text-left pb-2 pr-4">Route</th>
                <th className="text-left pb-2 pr-4">Technology</th>
                <th className="text-right pb-2 pr-4">Capacity (GW)</th>
                <th className="text-right pb-2 pr-4">Length (km)</th>
                <th className="text-right pb-2 pr-4">CapEx (A$bn)</th>
                <th className="text-left pb-2 pr-4">Status</th>
                <th className="text-right pb-2 pr-4">Target Year</th>
                <th className="text-left pb-2">Partners</th>
              </tr>
            </thead>
            <tbody>
              {data.cable_projects.map((p: EXECableProjectRecord) => (
                <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{p.name}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.route}</td>
                  <td className="py-2 pr-4">
                    <Badge
                      label={p.technology.replace('_', ' ')}
                      colourClass={TECH_COLOURS[p.technology] ?? 'bg-gray-600'}
                    />
                  </td>
                  <td className="py-2 pr-4 text-right text-cyan-300 font-mono">{p.capacity_gw}</td>
                  <td className="py-2 pr-4 text-right text-gray-300 font-mono">{p.length_km.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-yellow-300 font-mono">{p.capex_aud_bn}</td>
                  <td className="py-2 pr-4">
                    <Badge
                      label={p.status}
                      colourClass={STATUS_COLOURS[p.status] ?? 'bg-gray-600'}
                    />
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">{p.target_year ?? '—'}</td>
                  <td className="py-2 text-gray-400 text-xs">{p.equity_partners.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Energy Flow Chart ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Projected Export Volume — Top 3 Projects (TWh)</h2>
        <p className="text-xs text-gray-400 mb-4">Annual export TWh ramp-up from project commissioning</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={flowChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {top3Names.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={LINE_COLOURS[i % LINE_COLOURS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ─── Market Demand Chart ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Asian Market Demand Growth (TWh)</h2>
        <p className="text-xs text-gray-400 mb-4">Electricity import demand by destination country</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={demandChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="country" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Current (TWh)" fill="#60a5fa" radius={[3, 3, 0, 0]} />
            <Bar dataKey="2030 (TWh)" fill="#34d399" radius={[3, 3, 0, 0]} />
            <Bar dataKey="2040 (TWh)" fill="#f472b6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ─── Supply Zone Chart ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Supply Zones — Solar/Wind Potential & LCOE</h2>
        <p className="text-xs text-gray-400 mb-4">Generation potential (GW) and LCOE (AUD/MWh) by zone</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={supplyChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="zone" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Solar GW" fill="#facc15" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Wind GW" fill="#22d3ee" radius={[3, 3, 0, 0]} />
            <Bar dataKey="LCOE (AUD/MWh)" fill="#f97316" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ─── Cost Benefit Table ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Cost-Benefit Analysis — Base Case</h2>
        <p className="text-xs text-gray-400 mb-4">IRR, NPV and net margin per project under base case assumptions</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Project ID</th>
                <th className="text-left pb-2 pr-4">Scenario</th>
                <th className="text-right pb-2 pr-4">LCOE (AUD/MWh)</th>
                <th className="text-right pb-2 pr-4">Export Price (USD/MWh)</th>
                <th className="text-right pb-2 pr-4">Trans. Cost (AUD/MWh)</th>
                <th className="text-right pb-2 pr-4">Net Margin (USD/MWh)</th>
                <th className="text-right pb-2 pr-4">IRR (%)</th>
                <th className="text-right pb-2 pr-4">Payback (yrs)</th>
                <th className="text-right pb-2">NPV (A$bn)</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(baseCaseCB).map((cb: EXECostBenefitRecord) => (
                <tr key={cb.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 text-cyan-300 font-mono text-xs">{cb.project_id}</td>
                  <td className="py-2 pr-4 text-gray-300">{cb.scenario}</td>
                  <td className="py-2 pr-4 text-right font-mono text-gray-200">{cb.lcoe_aud_per_mwh.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-green-300">{cb.export_price_usd_per_mwh.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-gray-200">{cb.transmission_cost_aud_per_mwh.toFixed(1)}</td>
                  <td className={`py-2 pr-4 text-right font-mono ${cb.net_margin_usd_per_mwh >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {cb.net_margin_usd_per_mwh.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-yellow-300">{cb.irr_pct.toFixed(2)}%</td>
                  <td className="py-2 pr-4 text-right font-mono text-gray-300">{cb.payback_years.toFixed(1)}</td>
                  <td className={`py-2 text-right font-mono ${cb.npv_aud_bn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {cb.npv_aud_bn.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── All Scenarios Cost Benefit Table ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Full Scenario Analysis — IRR & NPV</h2>
        <p className="text-xs text-gray-400 mb-4">All scenarios across all projects</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Project ID</th>
                <th className="text-left pb-2 pr-4">Scenario</th>
                <th className="text-right pb-2 pr-4">IRR (%)</th>
                <th className="text-right pb-2 pr-4">NPV (A$bn)</th>
                <th className="text-right pb-2">Payback (yrs)</th>
              </tr>
            </thead>
            <tbody>
              {data.cost_benefits.map((cb: EXECostBenefitRecord, i: number) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-1.5 pr-4 text-cyan-300 font-mono text-xs">{cb.project_id}</td>
                  <td className="py-1.5 pr-4 text-gray-300 text-xs">{cb.scenario}</td>
                  <td className="py-1.5 pr-4 text-right font-mono text-yellow-300 text-xs">{cb.irr_pct.toFixed(2)}%</td>
                  <td className={`py-1.5 pr-4 text-right font-mono text-xs ${cb.npv_aud_bn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {cb.npv_aud_bn.toFixed(2)}
                  </td>
                  <td className="py-1.5 text-right font-mono text-gray-300 text-xs">{cb.payback_years.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
