import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import {
  getGridFormingInverterDashboard,
  GFIDashboard,
  GFIInverterRecord,
  GFISystemStrengthRecord,
  GFIFaultRideRecord,
  GFIIbrPenetrationRecord,
} from '../api/client'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
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

// ── Technology badge ──────────────────────────────────────────────────────────

const TECH_STYLES: Record<string, { bg: string; text: string }> = {
  BESS:  { bg: '#1e40af33', text: '#60a5fa' },
  WIND:  { bg: '#14532d33', text: '#4ade80' },
  SOLAR: { bg: '#78350f33', text: '#fbbf24' },
  HVDC:  { bg: '#581c8733', text: '#c084fc' },
}

const INVERTER_STYLES: Record<string, { bg: string; text: string }> = {
  GRID_FORMING:   { bg: '#14532d33', text: '#4ade80' },
  GRID_FOLLOWING: { bg: '#37415133', text: '#9ca3af' },
}

const STRENGTH_STYLES: Record<string, { bg: string; text: string }> = {
  ADEQUATE:   { bg: '#14532d33', text: '#4ade80' },
  MARGINAL:   { bg: '#78350f33', text: '#fbbf24' },
  INADEQUATE: { bg: '#7f1d1d33', text: '#f87171' },
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string }> = {
  EXTREME:  { bg: '#7f1d1d33', text: '#f87171' },
  SEVERE:   { bg: '#9a3412' + '33', text: '#fb923c' },
  MODERATE: { bg: '#78350f33', text: '#fbbf24' },
  MILD:     { bg: '#14532d33', text: '#4ade80' },
}

const FAULT_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  VOLTAGE_DIP:         { bg: '#7f1d1d33', text: '#f87171' },
  FREQUENCY_DEVIATION: { bg: '#78350f33', text: '#fbbf24' },
  ISLANDING:           { bg: '#1e3a8a33', text: '#93c5fd' },
}

function Badge({ label, style }: { label: string; style: { bg: string; text: string } }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {label}
    </span>
  )
}

function BoolIcon({ value }: { value: boolean }) {
  return (
    <span style={{ color: value ? '#4ade80' : '#f87171' }} className="font-bold text-sm">
      {value ? '✓' : '✗'}
    </span>
  )
}

// ── Inverter Fleet Table ──────────────────────────────────────────────────────

function InverterFleetTable({ fleet }: { fleet: GFIInverterRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        Inverter Fleet Registry
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
              <th className="text-left pb-2 pr-3">Asset Name</th>
              <th className="text-left pb-2 pr-3">Region</th>
              <th className="text-left pb-2 pr-3">Technology</th>
              <th className="text-left pb-2 pr-3">Inverter Type</th>
              <th className="text-right pb-2 pr-3">Capacity (MW)</th>
              <th className="text-right pb-2 pr-3">SCR Contrib.</th>
              <th className="text-right pb-2 pr-3">Synth. Inertia (MWs)</th>
              <th className="text-center pb-2 pr-3">FRT</th>
              <th className="text-center pb-2 pr-3">V-Sup</th>
              <th className="text-center pb-2">F-Resp</th>
            </tr>
          </thead>
          <tbody>
            {fleet.map((a) => (
              <tr key={a.asset_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 font-medium text-white">{a.asset_name}</td>
                <td className="py-2 pr-3 text-gray-400">{a.region}</td>
                <td className="py-2 pr-3">
                  <Badge
                    label={a.technology}
                    style={TECH_STYLES[a.technology] ?? { bg: '#37415133', text: '#9ca3af' }}
                  />
                </td>
                <td className="py-2 pr-3">
                  <Badge
                    label={a.inverter_type.replace('_', ' ')}
                    style={INVERTER_STYLES[a.inverter_type] ?? { bg: '#37415133', text: '#9ca3af' }}
                  />
                </td>
                <td className="py-2 pr-3 text-right">{a.capacity_mw.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right">{a.scr_contribution.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right">{a.inertia_synthetic_mws}</td>
                <td className="py-2 pr-3 text-center"><BoolIcon value={a.fault_ride_through} /></td>
                <td className="py-2 pr-3 text-center"><BoolIcon value={a.voltage_support} /></td>
                <td className="py-2 text-center"><BoolIcon value={a.frequency_response} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── System Strength Panel ─────────────────────────────────────────────────────

const REGIONS = ['SA1', 'VIC1', 'NSW1', 'QLD1', 'TAS1']

function SystemStrengthPanel({ data }: { data: GFISystemStrengthRecord[] }) {
  const [activeRegion, setActiveRegion] = useState('SA1')

  const regionData = data.filter((d) => d.region === activeRegion)
  const latest = regionData[regionData.length - 1]

  const scrChartData = latest
    ? [
        { name: 'Minimum SCR', value: latest.scr_minimum, fill: '#f87171' },
        { name: 'Actual SCR', value: latest.scr_actual, fill: latest.scr_actual >= latest.scr_comfortable ? '#4ade80' : latest.scr_actual >= latest.scr_minimum ? '#fbbf24' : '#f87171' },
        { name: 'Comfortable SCR', value: latest.scr_comfortable, fill: '#60a5fa' },
      ]
    : []

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        System Strength (Short Circuit Ratio)
      </h2>

      {/* Region tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setActiveRegion(r)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeRegion === r
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {latest && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* SCR Bar Chart */}
          <div>
            <p className="text-xs text-gray-500 mb-2">SCR Comparison — {latest.date}</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={scrChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" domain={[0, 5]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={110} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                  labelStyle={{ color: '#e5e7eb' }}
                  itemStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {scrChartData.map((entry, index) => (
                    <rect key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Panel */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">System Strength Status</span>
              <Badge
                label={latest.strength_status}
                style={STRENGTH_STYLES[latest.strength_status] ?? { bg: '#37415133', text: '#9ca3af' }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">IBR Penetration</span>
              <span className="text-xl font-bold text-amber-400">{latest.ibr_penetration_pct}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Synchronous Generation</span>
              <span className="text-sm font-semibold text-white">{latest.synchronous_mw.toLocaleString()} MW</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">IBR Generation</span>
              <span className="text-sm font-semibold text-white">{latest.ibr_mw.toLocaleString()} MW</span>
            </div>
            {latest.risk_event !== 'None' && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-2">
                <p className="text-xs text-yellow-400 font-medium">Risk Event</p>
                <p className="text-xs text-yellow-300 mt-1">{latest.risk_event}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── IBR Penetration Trend ─────────────────────────────────────────────────────

function getSSIColor(ssi: number): string {
  if (ssi > 3) return '#4ade80'
  if (ssi > 1.8) return '#fbbf24'
  return '#f87171'
}

function IbrPenetrationTrend({ data }: { data: GFIIbrPenetrationRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState('SA1')

  const regionData = data
    .filter((d) => d.region === selectedRegion)
    .sort((a, b) => a.year - b.year)

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          IBR Penetration & System Strength Trend (2020–2030)
        </h2>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* IBR Penetration lines */}
        <div>
          <p className="text-xs text-gray-500 mb-2">IBR Penetration % vs GFM % of IBR</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={regionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Line
                type="monotone"
                dataKey="ibr_penetration_pct"
                name="IBR Penetration %"
                stroke="#f87171"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="gfm_pct_of_ibr"
                name="GFM % of IBR"
                stroke="#4ade80"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* System Strength Index */}
        <div>
          <p className="text-xs text-gray-500 mb-2">System Strength Index (SSI) — green &gt;3, yellow 1.8–3, red &lt;1.8</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={regionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis domain={[0, 5.5]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <ReferenceLine y={3} stroke="#4ade80" strokeDasharray="4 2" label={{ value: 'Comfortable', fill: '#4ade80', fontSize: 10 }} />
              <ReferenceLine y={1.8} stroke="#fbbf24" strokeDasharray="4 2" label={{ value: 'Marginal', fill: '#fbbf24', fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey="system_strength_index"
                name="SSI"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={(props: { cx: number; cy: number; payload: GFIIbrPenetrationRecord }) => (
                  <circle
                    key={`dot-${props.payload.year}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={getSSIColor(props.payload.system_strength_index)}
                    stroke="none"
                  />
                )}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── Fault Ride-Through Events Table ───────────────────────────────────────────

function FaultRideThroughTable({ events }: { events: GFIFaultRideRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        Fault Ride-Through Events
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
              <th className="text-left pb-2 pr-3">Event ID</th>
              <th className="text-left pb-2 pr-3">Date</th>
              <th className="text-left pb-2 pr-3">Region</th>
              <th className="text-left pb-2 pr-3">Fault Type</th>
              <th className="text-left pb-2 pr-3">Severity</th>
              <th className="text-right pb-2 pr-3">GFM Resp (ms)</th>
              <th className="text-right pb-2 pr-3">GFL Resp (ms)</th>
              <th className="text-center pb-2 pr-3">GFM Rode</th>
              <th className="text-right pb-2 pr-3">Gen Lost (MW)</th>
              <th className="text-right pb-2">Freq Nadir (Hz)</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.event_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 font-mono text-gray-400 text-xs">{e.event_id}</td>
                <td className="py-2 pr-3 text-gray-400">{e.date}</td>
                <td className="py-2 pr-3 text-white font-medium">{e.region}</td>
                <td className="py-2 pr-3">
                  <Badge
                    label={e.fault_type.replace(/_/g, ' ')}
                    style={FAULT_TYPE_STYLES[e.fault_type] ?? { bg: '#37415133', text: '#9ca3af' }}
                  />
                </td>
                <td className="py-2 pr-3">
                  <Badge
                    label={e.severity}
                    style={SEVERITY_STYLES[e.severity] ?? { bg: '#37415133', text: '#9ca3af' }}
                  />
                </td>
                <td className="py-2 pr-3 text-right font-mono text-green-400">{e.gfm_response_ms}</td>
                <td className="py-2 pr-3 text-right font-mono text-orange-400">{e.gfl_response_ms}</td>
                <td className="py-2 pr-3 text-center"><BoolIcon value={e.gfm_rode_through} /></td>
                <td className="py-2 pr-3 text-right text-red-400">{e.generation_lost_mw}</td>
                <td className="py-2 text-right text-amber-400">{e.frequency_nadir_hz.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GridFormingInverterAnalytics() {
  const [data, setData] = useState<GFIDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGridFormingInverterDashboard()
      .then(setData)
      .catch((err) => setError(err.message ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading Grid-Forming Inverter Analytics...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-sm">{error ?? 'No data available'}</div>
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-yellow-500/10 rounded-lg">
          <Zap className="text-yellow-400" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Grid-Forming Inverter &amp; System Strength
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            GFM vs GFL inverter performance, system strength requirements, fault ride-through and IBR penetration analytics
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Tracked Assets"
          value={String(summary.total_assets ?? 10)}
          sub="Across all NEM regions"
        />
        <KpiCard
          label="Grid-Forming Inverters"
          value={String(summary.grid_forming_count ?? 0)}
          sub={`${summary.grid_following_count ?? 0} grid-following`}
          valueColor="#4ade80"
        />
        <KpiCard
          label="SA IBR Penetration"
          value={`${summary.sa_current_ibr_penetration_pct ?? 0}%`}
          sub="South Australia"
          valueColor="#f87171"
        />
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">SA System Strength</span>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              label={String(summary.sa_system_strength_status ?? 'UNKNOWN')}
              style={
                STRENGTH_STYLES[String(summary.sa_system_strength_status)] ??
                { bg: '#37415133', text: '#9ca3af' }
              }
            />
          </div>
          <span className="text-xs text-gray-500">GFM ride-through rate: {summary.gfm_ride_through_rate_pct}%</span>
        </div>
      </div>

      {/* Inverter Fleet Table */}
      <InverterFleetTable fleet={data.inverter_fleet} />

      {/* System Strength + IBR Penetration side by side on wide screens */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SystemStrengthPanel data={data.system_strength} />
        <IbrPenetrationTrend data={data.ibr_penetration} />
      </div>

      {/* Fault Ride-Through Events */}
      <FaultRideThroughTable events={data.fault_ride_through_events} />
    </div>
  )
}
