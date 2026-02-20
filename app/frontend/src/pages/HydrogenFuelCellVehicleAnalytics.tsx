import { useEffect, useState } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Truck, Fuel, Activity, MapPin } from 'lucide-react'
import {
  getHydrogenFuelCellVehiclesDashboard,
  HFVDashboard,
  HFVVehicleRecord,
  HFVRefuellingRecord,
  HFVEmissionRecord,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const SEGMENT_COLOURS: Record<string, string> = {
  BUS:           '#22d3ee',
  TRUCK_HEAVY:   '#f472b6',
  TRUCK_LIGHT:   '#4ade80',
  PASSENGER_CAR: '#facc15',
  TRAIN:         '#fb923c',
  FORKLIFT:      '#a78bfa',
}

const SOURCE_COLOURS: Record<string, string> = {
  GREEN: 'bg-green-700',
  BLUE:  'bg-blue-700',
  GREY:  'bg-gray-600',
}

const STATUS_COLOURS: Record<string, string> = {
  OPERATIONAL:       'bg-green-700',
  UNDER_CONSTRUCTION: 'bg-yellow-700',
  PLANNED:           'bg-gray-600',
}

const SCENARIO_COLOURS: Record<string, string> = {
  GREEN_H2:        '#4ade80',
  BLUE_H2:         '#60a5fa',
  GREY_H2:         '#9ca3af',
  DIESEL_BASELINE: '#f87171',
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

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, colourClass }: { label: string; colourClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold text-white ${colourClass}`}>
      {label}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HydrogenFuelCellVehicleAnalytics() {
  const [data, setData] = useState<HFVDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHydrogenFuelCellVehiclesDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Loading Hydrogen Fuel Cell Vehicle Analytics...</p>
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-red-400">Error: {error ?? 'No data'}</p>
    </div>
  )

  const summary = data.summary as Record<string, string | number>

  // ─── TCO comparison: BUS segment, FCEV vs Diesel vs BEV by year ─────────
  const busTCOData = data.tco_analysis
    .filter(t => t.segment === 'BUS')
    .sort((a, b) => a.year - b.year)
    .map(t => ({
      year: t.year,
      'FCEV': Math.round(t.fcev_tco_aud / 1000),
      'Diesel': Math.round(t.diesel_tco_aud / 1000),
      'BEV': Math.round(t.bev_tco_aud / 1000),
    }))

  // ─── Deployment forecast: cumulative units by year by segment ────────────
  const deploymentByYear: Record<number, Record<string, number>> = {}
  for (const d of data.deployment_forecast) {
    if (!deploymentByYear[d.year]) deploymentByYear[d.year] = { year: d.year }
    deploymentByYear[d.year][d.segment] = d.cumulative_units
  }
  const deploymentChartData = Object.values(deploymentByYear).sort(
    (a, b) => (a.year as number) - (b.year as number)
  )

  // ─── Emissions comparison: lifecycle gCO2/km by segment and scenario ─────
  const segments = ['BUS', 'TRUCK_HEAVY', 'TRUCK_LIGHT', 'PASSENGER_CAR', 'TRAIN', 'FORKLIFT']
  const emissionsChartData = segments.map(seg => {
    const row: Record<string, string | number> = { segment: seg }
    for (const sc of ['GREEN_H2', 'BLUE_H2', 'GREY_H2', 'DIESEL_BASELINE']) {
      const rec = data.emissions.find(
        (e: HFVEmissionRecord) => e.segment === seg && e.scenario === sc
      )
      if (rec) row[sc] = rec.lifecycle_gco2_per_km
    }
    return row
  })

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-8">

      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gray-800 rounded-xl">
          <Truck className="w-7 h-7 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Hydrogen Fuel Cell Vehicle Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australian FCEV fleet deployment, refuelling infrastructure, TCO parity, and emissions abatement
          </p>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="FCEV Fleet (Australia)"
          value={String(summary.total_vehicles_australia ?? 0)}
          sub="Hydrogen vehicles deployed"
          Icon={Truck}
        />
        <KpiCard
          label="Operational Stations"
          value={String(summary.operational_stations ?? 0)}
          sub="H2 refuelling stations live"
          Icon={MapPin}
        />
        <KpiCard
          label="Bus TCO Breakeven"
          value={String(summary.bus_breakeven_year ?? 2031)}
          sub="Year FCEV beats diesel for buses"
          Icon={Activity}
        />
        <KpiCard
          label="H2 Demand 2040"
          value={`${((summary.total_h2_demand_2040_tpa as number) / 1000).toFixed(0)}k tpa`}
          sub="Total hydrogen demand from FCEVs"
          Icon={Fuel}
        />
      </div>

      {/* ─── Vehicle Table ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">FCEV Fleet in Australia</h2>
        <p className="text-xs text-gray-400 mb-4">
          Current hydrogen fuel cell vehicle models available or deployed in the Australian market
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Segment</th>
                <th className="text-left pb-2 pr-4">Manufacturer</th>
                <th className="text-left pb-2 pr-4">Model</th>
                <th className="text-right pb-2 pr-4">Range (km)</th>
                <th className="text-right pb-2 pr-4">H2 Use (kg/100km)</th>
                <th className="text-right pb-2 pr-4">Cost (AUD)</th>
                <th className="text-right pb-2 pr-4">Units in AU</th>
                <th className="text-right pb-2">Year</th>
              </tr>
            </thead>
            <tbody>
              {data.vehicles.map((v: HFVVehicleRecord, i: number) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-gray-900"
                      style={{ backgroundColor: SEGMENT_COLOURS[v.segment] ?? '#6b7280' }}
                    >
                      {v.segment}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-medium text-white">{v.manufacturer}</td>
                  <td className="py-2 pr-4 text-gray-300">{v.model}</td>
                  <td className="py-2 pr-4 text-right font-mono text-cyan-300">
                    {v.range_km.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-gray-300">
                    {v.fuel_consumption_kg_per_100km.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-yellow-300">
                    ${v.cost_aud.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-green-300">
                    {v.units_in_australia}
                  </td>
                  <td className="py-2 text-right text-gray-400 font-mono">{v.year_available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── TCO Comparison LineChart ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">TCO Comparison — Bus Segment (AUD $000s)</h2>
        <p className="text-xs text-gray-400 mb-4">
          Total cost of ownership for FCEV, Diesel, and BEV buses, 2024–2035. FCEV TCO parity projected ~2031.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={busTCOData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="k" width={65} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(val: number) => [`$${val}k`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="FCEV"
              name="FCEV (H2)"
              stroke="#22d3ee"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="Diesel"
              name="Diesel"
              stroke="#f87171"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="BEV"
              name="BEV (Electric)"
              stroke="#4ade80"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ─── Deployment Forecast BarChart ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">FCEV Deployment Forecast — Cumulative Units by Segment</h2>
        <p className="text-xs text-gray-400 mb-4">
          Projected cumulative hydrogen vehicle deployment in Australia 2025–2040 by segment
        </p>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={deploymentChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {segments.map(seg => (
              <Bar
                key={seg}
                dataKey={seg}
                stackId="units"
                fill={SEGMENT_COLOURS[seg] ?? '#60a5fa'}
                radius={seg === 'FORKLIFT' ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ─── Refuelling Station Table ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">H2 Refuelling Infrastructure</h2>
        <p className="text-xs text-gray-400 mb-4">
          Hydrogen dispensing stations across Australia — capacity, utilisation, H2 source, and cost
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Station</th>
                <th className="text-left pb-2 pr-4">State</th>
                <th className="text-left pb-2 pr-4">Source</th>
                <th className="text-left pb-2 pr-4">Status</th>
                <th className="text-right pb-2 pr-4">Capacity (kg/d)</th>
                <th className="text-right pb-2 pr-4">Utilisation</th>
                <th className="text-right pb-2">H2 Price (AUD/kg)</th>
              </tr>
            </thead>
            <tbody>
              {data.refuelling_stations.map((s: HFVRefuellingRecord, i: number) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4 font-medium text-white">{s.name}</td>
                  <td className="py-2 pr-4 text-gray-300 font-mono text-xs">{s.state}</td>
                  <td className="py-2 pr-4">
                    <Badge label={s.source} colourClass={SOURCE_COLOURS[s.source] ?? 'bg-gray-600'} />
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={s.status.replace('_', ' ')} colourClass={STATUS_COLOURS[s.status] ?? 'bg-gray-600'} />
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-cyan-300">
                    {s.capacity_kg_per_day.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.min(s.utilisation_pct, 100)}%`,
                            backgroundColor: s.utilisation_pct > 70 ? '#4ade80' : s.utilisation_pct > 30 ? '#facc15' : '#9ca3af',
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs text-gray-300 w-10 text-right">
                        {s.utilisation_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className={`py-2 text-right font-mono font-semibold ${s.h2_cost_aud_per_kg <= 10 ? 'text-green-300' : 'text-yellow-300'}`}>
                    ${s.h2_cost_aud_per_kg.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Emissions Comparison BarChart ─── */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-1">Lifecycle Emissions by Segment and H2 Source (gCO2/km)</h2>
        <p className="text-xs text-gray-400 mb-4">
          Well-to-wheel lifecycle CO2 emissions per km for each vehicle segment under Green, Blue, Grey H2, and diesel baseline
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={emissionsChartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="segment" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" g" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(val: number) => [`${val.toFixed(1)} gCO2/km`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {['GREEN_H2', 'BLUE_H2', 'GREY_H2', 'DIESEL_BASELINE'].map(sc => (
              <Bar
                key={sc}
                dataKey={sc}
                name={sc.replace('_', ' ')}
                fill={SCENARIO_COLOURS[sc] ?? '#6b7280'}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>

        {/* Emissions abatement detail table */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Segment</th>
                <th className="text-left pb-2 pr-4">Scenario</th>
                <th className="text-right pb-2 pr-4">Tailpipe (gCO2/km)</th>
                <th className="text-right pb-2 pr-4">Lifecycle (gCO2/km)</th>
                <th className="text-right pb-2 pr-4">Abatement (t/vehicle/yr)</th>
                <th className="text-right pb-2">Abatement Cost (AUD/t)</th>
              </tr>
            </thead>
            <tbody>
              {data.emissions
                .filter((e: HFVEmissionRecord) => e.scenario !== 'DIESEL_BASELINE')
                .map((e: HFVEmissionRecord, i: number) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-4">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-gray-900"
                        style={{ backgroundColor: SEGMENT_COLOURS[e.segment] ?? '#6b7280' }}
                      >
                        {e.segment}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge
                        label={e.scenario.replace('_', ' ')}
                        colourClass={
                          e.scenario === 'GREEN_H2' ? 'bg-green-700'
                          : e.scenario === 'BLUE_H2' ? 'bg-blue-700'
                          : 'bg-gray-600'
                        }
                      />
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-gray-300">
                      {e.tailpipe_gco2_per_km.toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-cyan-300">
                      {e.lifecycle_gco2_per_km.toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-green-300">
                      {e.annual_abatement_tonnes_per_vehicle.toFixed(2)}
                    </td>
                    <td className={`py-2 text-right font-mono ${e.abatement_cost_aud_per_tonne > 300 ? 'text-red-300' : 'text-yellow-300'}`}>
                      {e.abatement_cost_aud_per_tonne > 0 ? `$${e.abatement_cost_aud_per_tonne.toFixed(0)}` : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
