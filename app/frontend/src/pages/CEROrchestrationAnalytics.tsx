import React, { useEffect, useState } from 'react'
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
} from 'recharts'
import { Wifi, RefreshCw, AlertTriangle, TrendingUp, Zap, Battery, DollarSign, Activity } from 'lucide-react'
import {
  getCEROrchestrationDashboard,
  CERODashboard,
  CEROOrchestratorRecord,
  CEROEventRecord,
  CEROProtocolRecord,
  CEROGridServiceRecord,
  CEROBenefitRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const EVENT_TYPE_BADGE: Record<string, string> = {
  FCAS_RAISE:          'bg-green-600 text-white',
  FCAS_LOWER:          'bg-teal-600 text-white',
  PEAK_DEMAND_RESPONSE:'bg-amber-600 text-white',
  GRID_EMERGENCY:      'bg-red-700 text-white',
  ARBITRAGE:           'bg-blue-600 text-white',
  NETWORK_RELIEF:      'bg-purple-600 text-white',
}

const TREND_BADGE: Record<string, string> = {
  GROWING:  'bg-green-600 text-white',
  STABLE:   'bg-blue-600 text-white',
  DECLINING:'bg-red-700 text-white',
}

const CONFIDENCE_BADGE: Record<string, string> = {
  HIGH:   'bg-green-700 text-white',
  MEDIUM: 'bg-amber-600 text-white',
  LOW:    'bg-red-700 text-white',
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ElementType
  accent?: string
}) {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border-l-4 ${accent ?? 'border-blue-500'}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-gray-400" />}
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------------

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const colour =
    pct >= 75 ? 'bg-green-500' :
    pct >= 55 ? 'bg-amber-500' :
    'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div
          className={`${colour} h-2 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-300 w-6 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-base font-semibold text-white mb-4">{title}</h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Orchestrator Fleet Table
// ---------------------------------------------------------------------------

function OrchestratorTable({ rows }: { rows: CEROOrchestratorRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
          <tr>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Platform</th>
            <th className="px-3 py-2">CER Types</th>
            <th className="px-3 py-2 text-right">Devices</th>
            <th className="px-3 py-2 text-right">Capacity MW</th>
            <th className="px-3 py-2 text-right">Storage MWh</th>
            <th className="px-3 py-2">Regions</th>
            <th className="px-3 py-2">Revenue Streams</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.orchestrator_id} className="border-t border-gray-700 hover:bg-gray-750">
              <td className="px-3 py-2 font-medium text-white">{r.company}</td>
              <td className="px-3 py-2 text-gray-400">{r.platform}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.cer_types_managed.map((t) => (
                    <span key={t} className="bg-blue-900 text-blue-200 text-xs px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 text-right">{r.devices_enrolled.toLocaleString()}</td>
              <td className="px-3 py-2 text-right text-green-400 font-semibold">{r.total_capacity_mw.toFixed(0)}</td>
              <td className="px-3 py-2 text-right text-teal-400">{r.total_storage_mwh.toFixed(0)}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.regions_operating.map((reg) => (
                    <span key={reg} className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{reg}</span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.revenue_streams.map((rs) => (
                    <span key={rs} className="bg-purple-900 text-purple-200 text-xs px-1.5 py-0.5 rounded">{rs.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event Dispatch History
// ---------------------------------------------------------------------------

function EventTable({ rows }: { rows: CEROEventRecord[] }) {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
          <tr>
            <th className="px-3 py-2">Event ID</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Orchestrator</th>
            <th className="px-3 py-2 text-right">Req MW</th>
            <th className="px-3 py-2 text-right">Del MW</th>
            <th className="px-3 py-2 text-right">Response %</th>
            <th className="px-3 py-2 text-right">Duration</th>
            <th className="px-3 py-2 text-right">Devices</th>
            <th className="px-3 py-2 text-right">Rev $k</th>
            <th className="px-3 py-2 text-right">Bill Impact $</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ev) => {
            const rr = ev.response_rate_pct
            const rrColour = rr >= 90 ? 'text-green-400' : rr >= 80 ? 'text-amber-400' : 'text-red-400'
            return (
              <tr key={ev.event_id} className="border-t border-gray-700 hover:bg-gray-750">
                <td className="px-3 py-2 font-mono text-xs text-gray-400">{ev.event_id}</td>
                <td className="px-3 py-2">{ev.date}</td>
                <td className="px-3 py-2">
                  <Badge
                    label={ev.event_type}
                    colorClass={EVENT_TYPE_BADGE[ev.event_type] ?? 'bg-gray-600 text-white'}
                  />
                </td>
                <td className="px-3 py-2 text-gray-400">{ev.orchestrator_id}</td>
                <td className="px-3 py-2 text-right">{ev.requested_mw.toFixed(0)}</td>
                <td className="px-3 py-2 text-right text-green-400">{ev.delivered_mw.toFixed(0)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${rrColour}`}>{ev.response_rate_pct.toFixed(1)}%</td>
                <td className="px-3 py-2 text-right">{ev.duration_min} min</td>
                <td className="px-3 py-2 text-right">{ev.devices_activated.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-amber-400">{ev.revenue_k.toFixed(1)}</td>
                <td className="px-3 py-2 text-right text-teal-400">+${ev.customer_bill_impact.toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Response Rate Chart (events over time)
// ---------------------------------------------------------------------------

function ResponseRateChart({ events }: { events: CEROEventRecord[] }) {
  const data = [...events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((ev) => ({
      date: ev.date.slice(0, 7),
      response_rate: ev.response_rate_pct,
      event_type: ev.event_type,
    }))

  // Group by month, average response rate
  const monthly: Record<string, { total: number; count: number }> = {}
  data.forEach(({ date, response_rate }) => {
    if (!monthly[date]) monthly[date] = { total: 0, count: 0 }
    monthly[date].total += response_rate
    monthly[date].count += 1
  })

  const chartData = Object.entries(monthly).map(([month, { total, count }]) => ({
    month,
    avg_response_rate: parseFloat((total / count).toFixed(1)),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
        <YAxis domain={[70, 100]} tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="%" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#E5E7EB' }}
          itemStyle={{ color: '#34D399' }}
        />
        <Line
          type="monotone"
          dataKey="avg_response_rate"
          stroke="#34D399"
          strokeWidth={2}
          dot={{ fill: '#34D399', r: 3 }}
          name="Avg Response Rate %"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Protocols Table
// ---------------------------------------------------------------------------

function ProtocolsTable({ rows }: { rows: CEROProtocolRecord[] }) {
  const sorted = [...rows].sort((a, b) => b.devices_using_thousands - a.devices_using_thousands)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
          <tr>
            <th className="px-3 py-2">Protocol</th>
            <th className="px-3 py-2">CER Types</th>
            <th className="px-3 py-2 text-right">Devices (k)</th>
            <th className="px-3 py-2">Interoperability</th>
            <th className="px-3 py-2 text-right">Latency ms</th>
            <th className="px-3 py-2">Trend</th>
            <th className="px-3 py-2 text-center">Reg. Mandated</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.protocol} className="border-t border-gray-700 hover:bg-gray-750">
              <td className="px-3 py-2 font-semibold text-white">{r.protocol.replace(/_/g, '-')}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.cer_types.map((t) => (
                    <span key={t} className="bg-blue-900 text-blue-200 text-xs px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 text-right text-amber-400 font-semibold">{r.devices_using_thousands.toFixed(1)}</td>
              <td className="px-3 py-2 w-32"><ScoreBar score={r.interoperability_score} /></td>
              <td className="px-3 py-2 text-right">{r.latency_ms.toFixed(0)}</td>
              <td className="px-3 py-2">
                <Badge label={r.adoption_trend} colorClass={TREND_BADGE[r.adoption_trend] ?? 'bg-gray-600 text-white'} />
              </td>
              <td className="px-3 py-2 text-center">
                {r.regulatory_mandated
                  ? <span className="text-green-400 font-bold">YES</span>
                  : <span className="text-gray-500">No</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grid Services BarChart — CER share by service
// ---------------------------------------------------------------------------

function GridServicesChart({ rows }: { rows: CEROGridServiceRecord[] }) {
  // Aggregate CER share by service (average across regions)
  const byService: Record<string, { totalShare: number; count: number; totalCap: number }> = {}
  rows.forEach((r) => {
    if (!byService[r.service]) byService[r.service] = { totalShare: 0, count: 0, totalCap: 0 }
    byService[r.service].totalShare += r.cer_share_of_total_pct
    byService[r.service].count += 1
    byService[r.service].totalCap += r.cer_capacity_mw
  })
  const chartData = Object.entries(byService).map(([svc, d]) => ({
    service: svc.replace(/_/g, ' '),
    avg_cer_share: parseFloat((d.totalShare / d.count).toFixed(1)),
    total_capacity_mw: parseFloat(d.totalCap.toFixed(0)),
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="service"
          tick={{ fill: '#9CA3AF', fontSize: 10 }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis yAxisId="left" tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="%" />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9CA3AF', fontSize: 11 }} unit=" MW" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#E5E7EB' }}
        />
        <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12, paddingTop: 8 }} />
        <Bar yAxisId="left" dataKey="avg_cer_share" name="CER Share %" fill="#6366F1" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="right" dataKey="total_capacity_mw" name="Total Capacity MW" fill="#34D399" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Grid Services Detail Table
// ---------------------------------------------------------------------------

function GridServicesTable({ rows }: { rows: CEROGridServiceRecord[] }) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
          <tr>
            <th className="px-3 py-2">Service</th>
            <th className="px-3 py-2">Region</th>
            <th className="px-3 py-2 text-right">CER Capacity MW</th>
            <th className="px-3 py-2 text-right">CER Share %</th>
            <th className="px-3 py-2 text-right">Avg Response sec</th>
            <th className="px-3 py-2 text-right">Annual Rev $M</th>
            <th className="px-3 py-2 text-right">Growth YoY %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.service}-${r.region}-${i}`} className="border-t border-gray-700 hover:bg-gray-750">
              <td className="px-3 py-2 font-medium text-white">{r.service.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2">
                <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{r.region}</span>
              </td>
              <td className="px-3 py-2 text-right text-green-400">{r.cer_capacity_mw.toFixed(1)}</td>
              <td className="px-3 py-2 text-right text-blue-400 font-semibold">{r.cer_share_of_total_pct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right">{r.avg_response_time_sec.toFixed(2)}</td>
              <td className="px-3 py-2 text-right text-amber-400">{r.annual_revenue_m.toFixed(1)}</td>
              <td className="px-3 py-2 text-right text-teal-400">+{r.growth_yoy_pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Benefits Stacked Bar Chart (quarterly)
// ---------------------------------------------------------------------------

const BENEFIT_COLOURS: Record<string, string> = {
  BILL_SAVINGS:     '#34D399',
  FCAS_REVENUE:     '#6366F1',
  NETWORK_DEFERRAL: '#F59E0B',
  CARBON_ABATEMENT: '#10B981',
  GRID_STABILITY:   '#8B5CF6',
}

function BenefitsStackedChart({ rows }: { rows: CEROBenefitRecord[] }) {
  const quarters = ['2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4']
  const benefitTypes = Array.from(new Set(rows.map((r) => r.benefit_type)))

  const chartData = quarters.map((q) => {
    const entry: Record<string, string | number> = { quarter: q }
    benefitTypes.forEach((bt) => {
      const match = rows.find((r) => r.quarter === q && r.benefit_type === bt)
      entry[bt] = match ? match.cer_contribution_m : 0
    })
    return entry
  })

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="quarter" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} unit=" $M" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#E5E7EB' }}
        />
        <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 11 }} />
        {benefitTypes.map((bt) => (
          <Bar
            key={bt}
            dataKey={bt}
            stackId="benefits"
            fill={BENEFIT_COLOURS[bt] ?? '#60A5FA'}
            name={bt.replace(/_/g, ' ')}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Benefits Detail Table
// ---------------------------------------------------------------------------

function BenefitsTable({ rows }: { rows: CEROBenefitRecord[] }) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-700">
          <tr>
            <th className="px-3 py-2">Benefit Type</th>
            <th className="px-3 py-2">Quarter</th>
            <th className="px-3 py-2 text-right">CER Contribution $M</th>
            <th className="px-3 py-2 text-right">Per Device $/yr</th>
            <th className="px-3 py-2 text-right">System-Wide $M</th>
            <th className="px-3 py-2">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.benefit_type}-${r.quarter}-${i}`} className="border-t border-gray-700 hover:bg-gray-750">
              <td className="px-3 py-2 font-medium text-white">{r.benefit_type.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2 text-gray-400">{r.quarter}</td>
              <td className="px-3 py-2 text-right text-green-400 font-semibold">{r.cer_contribution_m.toFixed(2)}</td>
              <td className="px-3 py-2 text-right text-teal-400">${r.per_device_annual.toFixed(0)}</td>
              <td className="px-3 py-2 text-right text-amber-400">{r.system_wide_m.toFixed(1)}</td>
              <td className="px-3 py-2">
                <Badge label={r.confidence} colorClass={CONFIDENCE_BADGE[r.confidence] ?? 'bg-gray-600 text-white'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CEROrchestrationAnalytics() {
  const [data, setData] = useState<CERODashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getCEROrchestrationDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={20} />
        Loading CER Orchestration Analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="mr-2" size={20} />
        {error ?? 'No data available'}
      </div>
    )
  }

  const s = data.summary as Record<string, number>

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wifi className="text-blue-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">CER Orchestration Analytics</h1>
            <p className="text-sm text-gray-400">
              Consumer Energy Resources — solar, batteries, EVs &amp; heat pumps coordinated for grid services
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <KpiCard
          label="Enrolled Devices"
          value={`${s.total_devices_enrolled_thousands}k`}
          sub="across all orchestrators"
          icon={Activity}
          accent="border-blue-500"
        />
        <KpiCard
          label="Total Capacity"
          value={`${s.total_capacity_mw.toLocaleString()} MW`}
          sub="dispatchable CER"
          icon={Zap}
          accent="border-green-500"
        />
        <KpiCard
          label="Avg Response Rate"
          value={`${s.avg_response_rate_pct}%`}
          sub="dispatch compliance"
          icon={TrendingUp}
          accent="border-teal-500"
        />
        <KpiCard
          label="Annual Revenue"
          value={`$${s.total_annual_revenue_m}M`}
          sub="grid services earnings"
          icon={DollarSign}
          accent="border-amber-500"
        />
        <KpiCard
          label="CER Share FCAS"
          value={`${s.cer_share_fcas_pct}%`}
          sub="of total FCAS capacity"
          icon={Battery}
          accent="border-purple-500"
        />
        <KpiCard
          label="Bill Savings"
          value={`$${s.bill_savings_per_device_yr}/yr`}
          sub="per enrolled device"
          icon={DollarSign}
          accent="border-rose-500"
        />
        <KpiCard
          label="Events 2024"
          value={`${s.events_2024}`}
          sub="dispatch activations"
          icon={Activity}
          accent="border-indigo-500"
        />
      </div>

      {/* Orchestrator Fleet */}
      <Section title="Orchestrator Fleet Overview">
        <OrchestratorTable rows={data.orchestrators} />
      </Section>

      {/* Event Dispatch History */}
      <Section title="Event Dispatch History (2023–2024)">
        <div className="mb-4">
          <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2">Monthly Avg Response Rate</h3>
          <ResponseRateChart events={data.events} />
        </div>
        <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-2 mt-4">All Dispatch Events</h3>
        <EventTable rows={data.events} />
      </Section>

      {/* Interoperability Protocols */}
      <Section title="CER Interoperability Protocols">
        <ProtocolsTable rows={data.protocols} />
      </Section>

      {/* Grid Services */}
      <Section title="Grid Services — CER Contribution by Service">
        <GridServicesChart rows={data.grid_services} />
        <GridServicesTable rows={data.grid_services} />
      </Section>

      {/* Benefits Quantification */}
      <Section title="Benefits Quantification (2024 Quarterly)">
        <BenefitsStackedChart rows={data.benefits} />
        <BenefitsTable rows={data.benefits} />
      </Section>
    </div>
  )
}
