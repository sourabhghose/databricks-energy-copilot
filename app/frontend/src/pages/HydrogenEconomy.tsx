import { useEffect, useState } from 'react'
import { Fuel } from 'lucide-react'
import {
  api,
  H2EconomyDashboard,
  H2ProductionFacility,
  H2ExportTerminal,
  H2RefuellingStation,
  H2CostBenchmark,
} from '../api/client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  sub,
  valueColor,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold" style={{ color: valueColor ?? '#fff' }}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  OPERATING:    { bg: '#15803d33', text: '#4ade80' },
  CONSTRUCTION: { bg: '#d9770633', text: '#fb923c' },
  APPROVED:     { bg: '#1d4ed833', text: '#60a5fa' },
  FEASIBILITY:  { bg: '#37415133', text: '#9ca3af' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {status}
    </span>
  )
}

// ── Hydrogen type badge ───────────────────────────────────────────────────────

const H2_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  GREEN:     { bg: '#15803d33', text: '#4ade80' },
  BLUE:      { bg: '#1d4ed833', text: '#60a5fa' },
  TURQUOISE: { bg: '#0f766e33', text: '#2dd4bf' },
}

function H2TypeBadge({ type }: { type: string }) {
  const s = H2_TYPE_STYLES[type] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {type}
    </span>
  )
}

// ── Carrier badge ─────────────────────────────────────────────────────────────

const CARRIER_STYLES: Record<string, { bg: string; text: string }> = {
  AMMONIA: { bg: '#c2410c33', text: '#fb923c' },
  LH2:     { bg: '#1d4ed833', text: '#60a5fa' },
  MCH:     { bg: '#6d28d933', text: '#c084fc' },
}

function CarrierBadge({ carrier }: { carrier: string }) {
  const s = CARRIER_STYLES[carrier] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {carrier}
    </span>
  )
}

// ── Vehicle type badge ────────────────────────────────────────────────────────

const VEHICLE_STYLES: Record<string, { bg: string; text: string }> = {
  HCV:       { bg: '#92400e33', text: '#fbbf24' },
  BUS:       { bg: '#0e749233', text: '#22d3ee' },
  PASSENGER: { bg: '#37415133', text: '#9ca3af' },
}

function VehicleTypeBadge({ type }: { type: string }) {
  const s = VEHICLE_STYLES[type] ?? { bg: '#37415133', text: '#9ca3af' }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {type}
    </span>
  )
}

// ── LCOH Cost Reduction Chart ─────────────────────────────────────────────────

function LcohCostChart({ benchmarks }: { benchmarks: H2CostBenchmark[] }) {
  // Build a year-keyed map: { 2020: { GREEN: x, BLUE: y }, ... }
  const byYear: Record<number, Record<string, number>> = {}
  for (const b of benchmarks) {
    if (!byYear[b.year]) byYear[b.year] = {}
    byYear[b.year][b.technology] = b.lcoh_kg
  }
  const chartData = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, vals]) => ({ year: Number(year), ...vals }))

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">
        LCOH Cost Reduction Trajectory ($/kg) — 2020-2030
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
            domain={[1.5, 10]}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number) => [`$${val.toFixed(2)}/kg`]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
          <Line
            type="monotone"
            dataKey="GREEN"
            stroke="#4ade80"
            strokeWidth={2}
            dot={{ r: 3, fill: '#4ade80' }}
            activeDot={{ r: 5 }}
            name="Green H2"
          />
          <Line
            type="monotone"
            dataKey="BLUE"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 3, fill: '#60a5fa' }}
            activeDot={{ r: 5 }}
            name="Blue H2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Production Facilities Table ───────────────────────────────────────────────

function ProductionTable({ facilities }: { facilities: H2ProductionFacility[] }) {
  const [filter, setFilter] = useState<string>('ALL')
  const types = ['ALL', 'GREEN', 'BLUE', 'TURQUOISE']

  const filtered = filter === 'ALL' ? facilities : facilities.filter((f) => f.hydrogen_type === filter)

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-300">Production Facilities</h2>
        <div className="flex gap-2">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                filter === t
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
              <th className="text-left py-2 pr-3">Facility</th>
              <th className="text-left py-2 pr-3">Developer</th>
              <th className="text-left py-2 pr-3">State</th>
              <th className="text-left py-2 pr-3">Type</th>
              <th className="text-left py-2 pr-3">Production</th>
              <th className="text-right py-2 pr-3">Cap (t/d)</th>
              <th className="text-left py-2 pr-3">Status</th>
              <th className="text-right py-2 pr-3">CAPEX ($M)</th>
              <th className="text-right py-2 pr-3">LCOH ($/kg)</th>
              <th className="text-right py-2">CO2 (kg/kg)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.facility_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 text-gray-200 font-medium">{f.facility_name}</td>
                <td className="py-2 pr-3 text-gray-400 text-xs">{f.developer}</td>
                <td className="py-2 pr-3 text-gray-400">{f.state}</td>
                <td className="py-2 pr-3">
                  <H2TypeBadge type={f.hydrogen_type} />
                </td>
                <td className="py-2 pr-3 text-gray-400 text-xs">{f.production_type.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-3 text-right text-gray-200">{f.capacity_tpd.toFixed(0)}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={f.status} />
                </td>
                <td className="py-2 pr-3 text-right text-gray-200">{f.capex_m_aud.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right font-mono text-teal-400">${f.lcoh_kg.toFixed(2)}</td>
                <td className="py-2 text-right text-gray-400">{f.co2_intensity_kgco2_kgh2.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Export Terminals Table ────────────────────────────────────────────────────

function ExportTerminalsTable({ terminals }: { terminals: H2ExportTerminal[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Export Terminals</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
              <th className="text-left py-2 pr-3">Terminal</th>
              <th className="text-left py-2 pr-3">Port</th>
              <th className="text-left py-2 pr-3">State</th>
              <th className="text-left py-2 pr-3">Carrier</th>
              <th className="text-right py-2 pr-3">Capacity (t/yr)</th>
              <th className="text-left py-2 pr-3">Status</th>
              <th className="text-right py-2 pr-3">First Export</th>
              <th className="text-right py-2 pr-3">CAPEX ($B)</th>
              <th className="text-left py-2">Target Markets</th>
            </tr>
          </thead>
          <tbody>
            {terminals.map((t) => (
              <tr key={t.terminal_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 text-gray-200 font-medium">{t.terminal_name}</td>
                <td className="py-2 pr-3 text-gray-400">{t.port}</td>
                <td className="py-2 pr-3 text-gray-400">{t.state}</td>
                <td className="py-2 pr-3">
                  <CarrierBadge carrier={t.carrier} />
                </td>
                <td className="py-2 pr-3 text-right text-gray-200">{t.capacity_tpa.toLocaleString()}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="py-2 pr-3 text-right text-gray-400">{t.first_export_year ?? '—'}</td>
                <td className="py-2 pr-3 text-right text-gray-200">${t.capex_b_aud.toFixed(1)}B</td>
                <td className="py-2 text-gray-400 text-xs">{t.target_markets.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Refuelling Stations Table ─────────────────────────────────────────────────

function RefuellingTable({ stations }: { stations: H2RefuellingStation[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Refuelling Stations</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
              <th className="text-left py-2 pr-3">Location</th>
              <th className="text-left py-2 pr-3">State</th>
              <th className="text-right py-2 pr-3">Capacity (kg/d)</th>
              <th className="text-right py-2 pr-3">Pressure (bar)</th>
              <th className="text-left py-2 pr-3">Vehicle Type</th>
              <th className="text-left py-2 pr-3">Status</th>
              <th className="text-right py-2 pr-3">Daily Txns</th>
              <th className="text-right py-2">Price ($/kg)</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.station_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 text-gray-200 font-medium">{s.location}</td>
                <td className="py-2 pr-3 text-gray-400">{s.state}</td>
                <td className="py-2 pr-3 text-right text-gray-200">{s.capacity_kgd.toFixed(0)}</td>
                <td className="py-2 pr-3 text-right text-gray-400">{s.pressure_bar}</td>
                <td className="py-2 pr-3">
                  <VehicleTypeBadge type={s.vehicle_type} />
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="py-2 pr-3 text-right text-gray-400">
                  {s.daily_transactions != null ? s.daily_transactions : '—'}
                </td>
                <td className="py-2 text-right font-mono text-teal-400">
                  {s.price_per_kg != null ? `$${s.price_per_kg.toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HydrogenEconomy() {
  const [dashboard, setDashboard] = useState<H2EconomyDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getHydrogenEconomyDashboard()
      .then(setDashboard)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-400 animate-pulse">Loading Hydrogen Economy data…</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-red-400">Error: {error ?? 'No data'}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-lg bg-teal-900/50">
          <Fuel className="text-teal-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">
            Hydrogen Economy &amp; Infrastructure Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Green &amp; blue hydrogen production facilities, export terminals, refuelling
            infrastructure, and levelised cost benchmarks across Australia.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Production Capacity"
          value={dashboard.total_production_capacity_tpd.toFixed(0)}
          unit="t/day"
          sub="All facilities combined"
          valueColor="#2dd4bf"
        />
        <KpiCard
          label="Operating Facilities"
          value={dashboard.operating_facilities}
          unit="sites"
          sub="Currently producing"
          valueColor="#4ade80"
        />
        <KpiCard
          label="Total Export Capacity"
          value={(dashboard.total_export_capacity_tpa / 1000).toFixed(0) + 'k'}
          unit="t/yr"
          sub="All export terminals"
          valueColor="#60a5fa"
        />
        <KpiCard
          label="Avg Green LCOH"
          value={`$${dashboard.avg_lcoh_green.toFixed(2)}`}
          unit="/kg"
          sub="Levelised cost of hydrogen"
          valueColor="#fb923c"
        />
      </div>

      {/* LCOH Cost Reduction Chart */}
      <LcohCostChart benchmarks={dashboard.cost_benchmarks} />

      {/* Production Facilities Table */}
      <ProductionTable facilities={dashboard.production_facilities} />

      {/* Export Terminals Table */}
      <ExportTerminalsTable terminals={dashboard.export_terminals} />

      {/* Refuelling Stations Table */}
      <RefuellingTable stations={dashboard.refuelling_stations} />

      <p className="text-xs text-gray-600 text-right">
        Sprint 44b — Hydrogen Economy &amp; Infrastructure Analytics
      </p>
    </div>
  )
}
