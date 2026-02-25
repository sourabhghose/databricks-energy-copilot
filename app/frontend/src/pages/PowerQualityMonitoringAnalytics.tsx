import { useEffect, useState } from 'react'
import { Gauge, Zap, Activity, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { getPQMADashboard } from '../api/client'
import type { PQMADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const SUBSTATION_COLOURS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6']
const INCIDENT_COLOURS: Record<string, string> = {
  voltage_sag: '#ef4444',
  voltage_swell: '#f59e0b',
  harmonic: '#8b5cf6',
  flicker: '#3b82f6',
}
const THD_THRESHOLD = 5

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------
function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    MINOR: 'bg-yellow-900 text-yellow-300',
    MODERATE: 'bg-orange-900 text-orange-300',
    MAJOR: 'bg-red-900 text-red-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[severity] ?? 'bg-gray-700 text-gray-300'}`}>
      {severity}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function PowerQualityMonitoringAnalytics() {
  const [data, setData] = useState<PQMADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPQMADashboard()
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-red-400">Error loading dashboard: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading Power Quality Monitoring Analytics...</p>
      </div>
    )
  }

  // --- Derived KPIs ---
  const avgVoltageCompliance =
    data.substations.reduce((s, r) => s + r.voltage_compliance_pct, 0) / data.substations.length
  const totalHarmonicEvents = data.incidents.reduce((s, r) => s + r.harmonic_count, 0)
  const avgPowerFactor =
    data.substations.reduce((s, r) => s + r.power_factor, 0) / data.substations.length
  const avgFlickerPST =
    data.substations.reduce((s, r) => s + r.flicker_pst, 0) / data.substations.length

  // --- Voltage profile: pivot to hour-based rows with 5 substations ---
  const profileSubstations = [...new Set(data.voltage_profiles.map((r) => r.substation_name))].slice(0, 5)
  const voltageByHour: Record<number, Record<string, number>> = {}
  let refUpper = 1.1
  let refLower = 0.9
  for (const vp of data.voltage_profiles) {
    if (!voltageByHour[vp.hour]) voltageByHour[vp.hour] = {}
    voltageByHour[vp.hour][vp.substation_name] = vp.voltage_pu
    refUpper = vp.upper_limit_pu
    refLower = vp.lower_limit_pu
  }
  const voltageChartData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    ...voltageByHour[h],
  }))

  // --- THD bar data ---
  const thdData = data.substations.map((s) => ({
    name: s.name,
    thd: s.thd_pct,
    above: s.thd_pct > THD_THRESHOLD,
  }))

  // --- Monthly incident stacked area ---
  const incidentData = data.incidents.map((r) => ({
    month: r.month,
    voltage_sag: r.voltage_sag_count,
    voltage_swell: r.voltage_swell_count,
    harmonic: r.harmonic_count,
    flicker: r.flicker_count,
  }))

  // --- Power Factor vs DER Penetration scatter ---
  const pfDerData = data.substations.map((s) => ({
    name: s.name,
    der_penetration_pct: s.der_penetration_pct,
    power_factor: s.power_factor,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-4 flex items-center gap-3">
        <Gauge className="text-amber-400" size={28} />
        <div>
          <h1 className="text-xl font-bold">Power Quality Monitoring Analytics</h1>
          <p className="text-xs text-gray-400">
            NEM-wide power quality metrics across distribution substations
          </p>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Voltage Compliance"
            value={`${avgVoltageCompliance.toFixed(1)}%`}
            sub="Avg across substations"
            icon={Zap}
            color="bg-blue-600"
          />
          <KpiCard
            title="Harmonic Distortion Events"
            value={totalHarmonicEvents.toLocaleString()}
            sub="Total over monitoring period"
            icon={Activity}
            color="bg-purple-600"
          />
          <KpiCard
            title="Power Factor Avg"
            value={avgPowerFactor.toFixed(3)}
            sub="Network-wide average"
            icon={Gauge}
            color="bg-emerald-600"
          />
          <KpiCard
            title="Flicker Severity Index"
            value={avgFlickerPST.toFixed(2)}
            sub="Avg PST across substations"
            icon={AlertTriangle}
            color="bg-amber-600"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Voltage Profile LineChart */}
          <ChartCard title="Voltage Profile at Key Substations (24hr)">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={voltageChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <YAxis domain={[0.88, 1.12]} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                <Legend />
                <ReferenceLine y={refUpper} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Upper', fill: '#ef4444', fontSize: 10 }} />
                <ReferenceLine y={refLower} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Lower', fill: '#ef4444', fontSize: 10 }} />
                {profileSubstations.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={SUBSTATION_COLOURS[i % SUBSTATION_COLOURS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* THD BarChart */}
          <ChartCard title="Harmonic Distortion (THD%) by Substation">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={thdData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" height={80} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                <ReferenceLine y={THD_THRESHOLD} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '5% Limit', fill: '#ef4444', fontSize: 10 }} />
                <Bar dataKey="thd" name="THD %">
                  {thdData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.above ? '#ef4444' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Incidents AreaChart */}
          <ChartCard title="Monthly Power Quality Incidents (Stacked)">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={incidentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="voltage_sag" stackId="1" stroke={INCIDENT_COLOURS.voltage_sag} fill={INCIDENT_COLOURS.voltage_sag} fillOpacity={0.7} name="Voltage Sag" />
                <Area type="monotone" dataKey="voltage_swell" stackId="1" stroke={INCIDENT_COLOURS.voltage_swell} fill={INCIDENT_COLOURS.voltage_swell} fillOpacity={0.7} name="Voltage Swell" />
                <Area type="monotone" dataKey="harmonic" stackId="1" stroke={INCIDENT_COLOURS.harmonic} fill={INCIDENT_COLOURS.harmonic} fillOpacity={0.7} name="Harmonic" />
                <Area type="monotone" dataKey="flicker" stackId="1" stroke={INCIDENT_COLOURS.flicker} fill={INCIDENT_COLOURS.flicker} fillOpacity={0.7} name="Flicker" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Power Factor vs DER Penetration ComposedChart */}
          <ChartCard title="Power Factor vs DER Penetration by Zone">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={pfDerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="der_penetration_pct" name="DER Penetration %" stroke="#9ca3af" tick={{ fontSize: 11 }} label={{ value: 'DER Penetration %', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 11 }} />
                <YAxis dataKey="power_factor" domain={[0.85, 1.0]} stroke="#9ca3af" tick={{ fontSize: 11 }} label={{ value: 'Power Factor', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                <Scatter dataKey="power_factor" fill="#f59e0b" name="Power Factor" />
                <Line type="monotone" dataKey="power_factor" stroke="#3b82f6" strokeWidth={2} dot={false} name="Trend" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Substation Power Quality Summary Table */}
        <div className="bg-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Substation Power Quality Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 pr-4">Substation</th>
                  <th className="pb-2 pr-4">DNSP</th>
                  <th className="pb-2 pr-4">Voltage Compliance %</th>
                  <th className="pb-2 pr-4">THD %</th>
                  <th className="pb-2 pr-4">Power Factor</th>
                  <th className="pb-2 pr-4">Flicker PST</th>
                </tr>
              </thead>
              <tbody>
                {data.substations.map((s) => (
                  <tr key={s.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-4 text-white font-medium">{s.name}</td>
                    <td className="py-2 pr-4 text-gray-300">{s.dnsp}</td>
                    <td className="py-2 pr-4 text-gray-300">{s.voltage_compliance_pct.toFixed(1)}</td>
                    <td className={`py-2 pr-4 ${s.thd_pct > THD_THRESHOLD ? 'text-red-400' : 'text-green-400'}`}>
                      {s.thd_pct.toFixed(1)}
                    </td>
                    <td className="py-2 pr-4 text-gray-300">{s.power_factor.toFixed(3)}</td>
                    <td className="py-2 pr-4 text-gray-300">{s.flicker_pst.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Power Quality Events Table */}
        <div className="bg-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Recent Power Quality Events</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Substation</th>
                  <th className="pb-2 pr-4">Event Type</th>
                  <th className="pb-2 pr-4">Severity</th>
                  <th className="pb-2 pr-4">Duration (min)</th>
                  <th className="pb-2 pr-4">Affected Customers</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((ev, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-4 text-gray-300">{ev.event_date}</td>
                    <td className="py-2 pr-4 text-white font-medium">{ev.substation_name}</td>
                    <td className="py-2 pr-4 text-gray-300">{ev.event_type.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-4"><SeverityBadge severity={ev.severity} /></td>
                    <td className="py-2 pr-4 text-gray-300">{ev.duration_min.toFixed(1)}</td>
                    <td className="py-2 pr-4 text-gray-300">{ev.affected_customers.toLocaleString()}</td>
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
