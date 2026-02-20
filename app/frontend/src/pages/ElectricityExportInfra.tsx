import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Globe2, Anchor, Zap, DollarSign } from 'lucide-react'
import { getElectricityExportDashboard, ElectricityExportDashboard } from '../api/client'

// ─── Colour maps ──────────────────────────────────────────────────────────────
const STATUS_COLOURS: Record<string, string> = {
  OPERATING:    'bg-green-600',
  CONSTRUCTION: 'bg-blue-600',
  APPROVED:     'bg-cyan-600',
  PROPOSED:     'bg-yellow-600',
  CANCELLED:    'bg-red-600',
}

const FORM_COLOURS: Record<string, string> = {
  ELECTRICITY:    '#22d3ee',
  GREEN_H2:       '#4ade80',
  GREEN_AMMONIA:  '#facc15',
  LNG_CCS:        '#f97316',
}

const RESOURCE_COLOURS: Record<string, string> = {
  SOLAR:  'bg-yellow-500',
  WIND:   'bg-cyan-500',
  HYBRID: 'bg-purple-500',
}

const AGREEMENT_COLOURS: Record<string, string> = {
  SIGNED:      'bg-green-600',
  NEGOTIATING: 'bg-blue-500',
  MOU:         'bg-yellow-500',
  NONE:        'bg-gray-600',
}

const SCENARIO_COLOURS: Record<string, string> = {
  Conservative: '#60a5fa',
  Moderate:     '#34d399',
  Accelerated:  '#f472b6',
}

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

// ─── Badge helper ────────────────────────────────────────────────────────────
function Badge({ label, colourClass }: { label: string; colourClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold text-white ${colourClass}`}>
      {label}
    </span>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ElectricityExportInfra() {
  const [data, setData] = useState<ElectricityExportDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityExportDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Electricity Export Infrastructure data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  // ── Derived KPI values ───────────────────────────────────────────────────
  const totalCableCapacityGw = data.cable_projects
    .filter(p => p.status !== 'CANCELLED')
    .reduce((acc, p) => acc + p.capacity_gw, 0)

  const totalCapexBnAud = data.cable_projects
    .filter(p => p.status !== 'CANCELLED')
    .reduce((acc, p) => acc + p.capex_bn_aud, 0)

  const totalExportPotentialTwh = data.export_markets
    .reduce((acc, m) => acc + m.import_potential_twh_yr, 0)

  const signedCount = data.export_markets
    .filter(m => m.agreement_status === 'SIGNED').length

  // ── Bar chart data: export markets ──────────────────────────────────────
  const marketChartData = data.export_markets.map(m => ({
    country: m.destination_country,
    potential: m.import_potential_twh_yr,
    form: m.preferred_form,
  }))

  // ── Line chart data: economic projections ───────────────────────────────
  const projectionYears = [...new Set(data.economic_projections.map(p => p.year))].sort()
  const scenarios = [...new Set(data.economic_projections.map(p => p.scenario))]

  const projectionChartData = projectionYears.map(year => {
    const row: Record<string, number | string> = { year: String(year) }
    scenarios.forEach(sc => {
      const rec = data.economic_projections.find(p => p.scenario === sc && p.year === year)
      if (rec) row[sc] = rec.export_revenue_bn_aud
    })
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe2 className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Australian Electricity Export Infrastructure
          </h1>
          <p className="text-sm text-gray-400">
            Undersea cable projects, export-oriented renewable zones, and Asia-Pacific clean energy
            trade potential
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Cable Capacity (Active)"
          value={`${totalCableCapacityGw.toFixed(1)} GW`}
          sub="Across non-cancelled projects"
          Icon={Anchor}
        />
        <KpiCard
          label="Total Pipeline Capex"
          value={`A$${totalCapexBnAud.toFixed(1)} bn`}
          sub="Combined cable investment"
          Icon={DollarSign}
        />
        <KpiCard
          label="Total Export Potential"
          value={`${totalExportPotentialTwh.toFixed(0)} TWh/yr`}
          sub="Across 8 markets"
          Icon={Zap}
        />
        <KpiCard
          label="Signed Trade Agreements"
          value={String(signedCount)}
          sub="Of 8 export market targets"
          Icon={Globe2}
        />
      </div>

      {/* Cable Projects Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Anchor className="w-5 h-5 text-cyan-400" />
          Undersea Cable Projects
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-4">Project</th>
                <th className="text-left py-2 pr-4">Route</th>
                <th className="text-right py-2 pr-4">Cap (GW)</th>
                <th className="text-right py-2 pr-4">Length (km)</th>
                <th className="text-right py-2 pr-4">Capex (A$bn)</th>
                <th className="text-left py-2 pr-4">Technology</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2">COD</th>
              </tr>
            </thead>
            <tbody>
              {data.cable_projects.map(p => (
                <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white whitespace-nowrap">{p.name}</td>
                  <td className="py-2 pr-4 text-gray-300">{p.route}</td>
                  <td className="py-2 pr-4 text-right text-cyan-300">{p.capacity_gw.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right">{p.length_km.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-yellow-300">{p.capex_bn_aud.toFixed(1)}</td>
                  <td className="py-2 pr-4">
                    <Badge label={p.technology} colourClass="bg-indigo-600" />
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={p.status} colourClass={STATUS_COLOURS[p.status] ?? 'bg-gray-600'} />
                  </td>
                  <td className="py-2 text-right text-gray-300">{p.expected_cod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Renewable Export Zones Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Export-Oriented Renewable Zones
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-4">Zone</th>
                <th className="text-left py-2 pr-4">State</th>
                <th className="text-left py-2 pr-4">Resource</th>
                <th className="text-right py-2 pr-4">Potential (GW)</th>
                <th className="text-right py-2 pr-4">Committed (GW)</th>
                <th className="text-right py-2 pr-4">LCOE (A$/MWh)</th>
                <th className="text-left py-2 pr-4">Export</th>
                <th className="text-right py-2">Grid Cost (A$bn)</th>
              </tr>
            </thead>
            <tbody>
              {data.renewable_zones.map(z => (
                <tr key={z.zone_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white whitespace-nowrap">{z.zone_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{z.state}</td>
                  <td className="py-2 pr-4">
                    <Badge label={z.primary_resource} colourClass={RESOURCE_COLOURS[z.primary_resource] ?? 'bg-gray-600'} />
                  </td>
                  <td className="py-2 pr-4 text-right text-cyan-300">{z.potential_gw.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-green-300">{z.committed_gw.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-yellow-300">{z.estimated_lcoe_aud_mwh.toFixed(1)}</td>
                  <td className="py-2 pr-4">
                    {z.export_oriented
                      ? <Badge label="YES" colourClass="bg-green-600" />
                      : <Badge label="NO" colourClass="bg-gray-600" />}
                  </td>
                  <td className="py-2 text-right text-gray-300">{z.grid_connection_cost_bn_aud.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Export Market Comparison Bar Chart */}
        <div className="bg-gray-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-4">
            Export Market Import Potential (TWh/yr)
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={marketChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="country"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(val: number, _name: string, entry: { payload?: { form?: string } }) => [
                  `${val} TWh/yr`,
                  entry?.payload?.form ?? 'Potential',
                ]}
              />
              <Bar dataKey="potential" name="Import Potential (TWh/yr)" radius={[4, 4, 0, 0]}>
                {marketChartData.map((entry, i) => (
                  <Cell key={i} fill={FORM_COLOURS[entry.form] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-2">
            {Object.entries(FORM_COLOURS).map(([form, colour]) => (
              <div key={form} className="flex items-center gap-1.5 text-xs text-gray-300">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
                {form.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>

        {/* Economic Projections Multi-line Chart */}
        <div className="bg-gray-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-4">
            Export Revenue Scenarios (A$bn/yr)
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={projectionChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(val: number) => [`A$${val.toFixed(1)} bn`]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              {scenarios.map(sc => (
                <Line
                  key={sc}
                  type="monotone"
                  dataKey={sc}
                  stroke={SCENARIO_COLOURS[sc] ?? '#94a3b8'}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SCENARIO_COLOURS[sc] ?? '#94a3b8' }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Export Markets Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-cyan-400" />
          Asia-Pacific Clean Energy Trade Markets
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-2 pr-4">Country</th>
                <th className="text-right py-2 pr-4">Import Potential (TWh/yr)</th>
                <th className="text-left py-2 pr-4">Preferred Form</th>
                <th className="text-right py-2 pr-4">Carbon Price (USD/t)</th>
                <th className="text-left py-2 pr-4">Agreement Status</th>
                <th className="text-right py-2">Bilateral Trade (A$bn)</th>
              </tr>
            </thead>
            <tbody>
              {data.export_markets.map(m => (
                <tr key={m.destination_country} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{m.destination_country}</td>
                  <td className="py-2 pr-4 text-right text-cyan-300">{m.import_potential_twh_yr.toFixed(0)}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-gray-900"
                      style={{ backgroundColor: FORM_COLOURS[m.preferred_form] ?? '#6b7280' }}
                    >
                      {m.preferred_form.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">${m.carbon_price_usd_tonne.toFixed(0)}</td>
                  <td className="py-2 pr-4">
                    <Badge label={m.agreement_status} colourClass={AGREEMENT_COLOURS[m.agreement_status] ?? 'bg-gray-600'} />
                  </td>
                  <td className="py-2 text-right text-yellow-300">{m.bilateral_trade_bn_aud.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
