import { useEffect, useState, useMemo } from 'react'
import { Factory, RefreshCw, AlertTriangle } from 'lucide-react'
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
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts'
import {
  getLargeIndustrialDemandDashboard,
  type LIDDashboard,
  type LIDConsumerRecord,
  type LIDDemandResponseRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTOR_COLORS: Record<string, string> = {
  MINING:        '#f59e0b',
  SMELTING:      '#ef4444',
  MANUFACTURING: '#3b82f6',
  DATA_CENTRES:  '#06b6d4',
  DESALINATION:  '#10b981',
  CHEMICALS:     '#8b5cf6',
  STEEL:         '#6b7280',
  CEMENT:        '#d97706',
}

const SECTOR_BADGE: Record<string, string> = {
  MINING:        'bg-amber-800 text-amber-200',
  SMELTING:      'bg-red-800 text-red-200',
  MANUFACTURING: 'bg-blue-800 text-blue-200',
  DATA_CENTRES:  'bg-cyan-800 text-cyan-200',
  DESALINATION:  'bg-emerald-800 text-emerald-200',
  CHEMICALS:     'bg-violet-800 text-violet-200',
  STEEL:         'bg-gray-700 text-gray-300',
  CEMENT:        'bg-yellow-800 text-yellow-200',
}

const REGION_BADGE: Record<string, string> = {
  NSW1: 'bg-blue-900 text-blue-200',
  QLD1: 'bg-purple-900 text-purple-200',
  VIC1: 'bg-indigo-900 text-indigo-200',
  SA1:  'bg-rose-900 text-rose-200',
  TAS1: 'bg-teal-900 text-teal-200',
}

const CONTRACT_BADGE: Record<string, string> = {
  SPOT:      'bg-red-900 text-red-200',
  HEDGE:     'bg-green-900 text-green-200',
  BILATERAL: 'bg-blue-900 text-blue-200',
  MIXED:     'bg-amber-900 text-amber-200',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt1(v: number): string { return v.toFixed(1) }
function fmt0(v: number): string { return v.toFixed(0) }
function fmtPct(v: number): string { return `${v.toFixed(1)}%` }
function fmtAUD(v: number): string { return `$${v.toFixed(0)}` }
function fmtGWh(v: number): string { return `${v.toFixed(0)} GWh` }
function fmtMW(v: number): string { return `${v.toFixed(0)} MW` }

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ label, value, sub, accent = 'text-amber-400' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 border-b border-gray-700 pb-1">
      {title}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Consumer Table
// ---------------------------------------------------------------------------

function ConsumerTable({ consumers }: { consumers: LIDConsumerRecord[] }) {
  const maxGWh = useMemo(() => Math.max(...consumers.map(c => c.annual_consumption_gwh)), [consumers])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-gray-300">
        <thead>
          <tr className="text-gray-500 border-b border-gray-700 text-left">
            <th className="py-2 pr-3 font-medium">Consumer</th>
            <th className="py-2 pr-3 font-medium">Sector</th>
            <th className="py-2 pr-3 font-medium">Region</th>
            <th className="py-2 pr-3 font-medium">Contract</th>
            <th className="py-2 pr-3 font-medium">Interruptible</th>
            <th className="py-2 pr-3 font-medium">Peak MW</th>
            <th className="py-2 pr-3 font-medium min-w-[140px]">Annual Consumption</th>
          </tr>
        </thead>
        <tbody>
          {consumers.map(c => (
            <tr key={c.consumer_id} className="border-b border-gray-800 hover:bg-gray-750">
              <td className="py-2 pr-3 font-medium text-white">{c.name}</td>
              <td className="py-2 pr-3">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${SECTOR_BADGE[c.sector] ?? 'bg-gray-700 text-gray-300'}`}>
                  {c.sector}
                </span>
              </td>
              <td className="py-2 pr-3">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${REGION_BADGE[c.region] ?? 'bg-gray-700 text-gray-300'}`}>
                  {c.region}
                </span>
              </td>
              <td className="py-2 pr-3">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${CONTRACT_BADGE[c.contract_type] ?? 'bg-gray-700 text-gray-300'}`}>
                  {c.contract_type}
                </span>
              </td>
              <td className="py-2 pr-3">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${c.interruptible ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-400'}`}>
                  {c.interruptible ? 'Yes' : 'No'}
                </span>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmt0(c.peak_demand_mw)}</td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-1.5 min-w-[80px]">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full"
                      style={{ width: `${(c.annual_consumption_gwh / maxGWh) * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-gray-300 w-16 text-right">{fmt0(c.annual_consumption_gwh)} GWh</span>
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
// Demand Response Table
// ---------------------------------------------------------------------------

function DemandResponseTable({ records }: { records: LIDDemandResponseRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-gray-300">
        <thead>
          <tr className="text-gray-500 border-b border-gray-700 text-left">
            <th className="py-2 pr-3 font-medium">Consumer</th>
            <th className="py-2 pr-3 font-medium">Program</th>
            <th className="py-2 pr-3 font-medium text-right">Available MW</th>
            <th className="py-2 pr-3 font-medium text-right">Events</th>
            <th className="py-2 pr-3 font-medium text-right">MWh Curtailed</th>
            <th className="py-2 pr-3 font-medium text-right">Avg Notice (min)</th>
            <th className="py-2 pr-3 font-medium text-right">Payment ($/MWh)</th>
            <th className="py-2 pr-3 font-medium text-right">Reliability</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.consumer_id} className="border-b border-gray-800 hover:bg-gray-750">
              <td className="py-2 pr-3 font-medium text-white">{r.consumer_id}</td>
              <td className="py-2 pr-3">
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-800 text-indigo-200">
                  {r.program}
                </span>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-cyan-300">{fmt1(r.available_mw)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.activated_events}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmt1(r.total_mwh_curtailed)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmt1(r.avg_notice_minutes)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-green-300">{fmtAUD(r.payment_aud_per_mwh)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                <span className={`${r.reliability_pct >= 90 ? 'text-green-400' : r.reliability_pct >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                  {fmtPct(r.reliability_pct)}
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
// Main Page
// ---------------------------------------------------------------------------

export default function LargeIndustrialDemandAnalytics() {
  const [data, setData] = useState<LIDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getLargeIndustrialDemandDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  // --- Derived data ---

  const sectorConsumption = useMemo(() => {
    if (!data) return []
    const map: Record<string, number> = {}
    data.consumers.forEach(c => {
      map[c.sector] = (map[c.sector] ?? 0) + c.annual_consumption_gwh
    })
    return Object.entries(map)
      .map(([sector, total_gwh]) => ({ sector, total_gwh: Math.round(total_gwh) }))
      .sort((a, b) => b.total_gwh - a.total_gwh)
  }, [data])

  const firstConsumerProfiles = useMemo(() => {
    if (!data || data.consumers.length === 0) return []
    const cid = data.consumers[0].consumer_id
    return data.load_profiles
      .filter(lp => lp.consumer_id === cid)
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [data])

  const intensityChartData = useMemo(() => {
    if (!data) return []
    return data.energy_intensity.map(r => ({
      product: r.product,
      actual: r.energy_intensity_gwh_per_unit,
      benchmark: r.benchmark_intensity,
    }))
  }, [data])

  const retirementScatterData = useMemo(() => {
    if (!data) return []
    return data.retirement_risks.map(r => ({
      x: r.current_tariff_aud_mwh,
      y: r.risk_score,
      z: r.employment,
      sector: r.sector,
      consumer_id: r.consumer_id,
    }))
  }, [data])

  const summary = data?.summary as Record<string, number | string> | undefined

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={18} />
        <span>Loading Large Industrial Demand data…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertTriangle size={18} />
        <span>{error}</span>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Factory className="text-amber-400" size={28} />
          <div>
            <h1 className="text-xl font-bold text-white">Large Industrial Demand Analytics</h1>
            <p className="text-xs text-gray-400 mt-0.5">NEM major industrial & commercial electricity consumers</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Consumers"
          value={String(summary?.total_consumers ?? 0)}
          sub={`${summary?.sectors ?? 0} sectors across ${summary?.regions ?? 0} regions`}
          accent="text-amber-400"
        />
        <KpiCard
          label="Total Consumption"
          value={fmtGWh(Number(summary?.total_annual_consumption_gwh ?? 0))}
          sub="Annual aggregate"
          accent="text-cyan-400"
        />
        <KpiCard
          label="Total Peak Demand"
          value={fmtMW(Number(summary?.total_peak_demand_mw ?? 0))}
          sub="Combined peak load"
          accent="text-red-400"
        />
        <KpiCard
          label="DR Capacity"
          value={fmtMW(Number(summary?.total_dr_capacity_mw ?? 0))}
          sub={`${summary?.interruptible_count ?? 0} interruptible consumers`}
          accent="text-green-400"
        />
      </div>

      {/* Consumer Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader title="Large Industrial Consumers" />
        <ConsumerTable consumers={data.consumers} />
      </div>

      {/* Sector Consumption BarChart + Load Profile LineChart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sector BarChart */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <SectionHeader title="Annual Consumption by Sector (GWh)" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sectorConsumption} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#f59e0b' }}
                formatter={(v: number) => [`${fmt0(v)} GWh`, 'Total']}
              />
              <Bar dataKey="total_gwh" name="Total GWh" radius={[4, 4, 0, 0]}>
                {sectorConsumption.map(entry => (
                  <rect key={entry.sector} fill={SECTOR_COLORS[entry.sector] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Load Profile LineChart */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <SectionHeader title={`Load Profile — ${data.consumers[0]?.name ?? ''} (MW)`} />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={firstConsumerProfiles} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Line type="monotone" dataKey="weekday_avg_mw" name="Weekday Avg MW" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="weekend_avg_mw" name="Weekend Avg MW" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="peak_mw" name="Peak MW" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Energy Intensity horizontal BarChart */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader title="Energy Intensity — Actual vs Benchmark (GWh/unit)" />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart layout="vertical" data={intensityChartData} margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis type="category" dataKey="product" tick={{ fill: '#9ca3af', fontSize: 10 }} width={90} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            <Bar dataKey="actual" name="Actual Intensity" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={10} />
            <Bar dataKey="benchmark" name="Benchmark" fill="#10b981" radius={[0, 4, 4, 0]} barSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Retirement Risk Scatter + DR Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Scatter: tariff vs risk score, sized by employment */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <SectionHeader title="Retirement Risk: Tariff vs Risk Score (sized by employment)" />
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number" dataKey="x" name="Current Tariff"
                label={{ value: 'Tariff ($/MWh)', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 10 }}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
              />
              <YAxis
                type="number" dataKey="y" name="Risk Score"
                label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af', fontSize: 10 }}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                domain={[0, 10]}
              />
              <ZAxis type="number" dataKey="z" range={[30, 300]} name="Employment" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(v: number, name: string) => {
                  if (name === 'Current Tariff') return [`$${fmt1(v)}/MWh`, name]
                  if (name === 'Risk Score') return [fmt1(v), name]
                  if (name === 'Employment') return [fmt0(v) + ' workers', name]
                  return [v, name]
                }}
              />
              <Scatter
                data={retirementScatterData}
                fill="#ef4444"
                fillOpacity={0.7}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2">Bubble size proportional to employment. High right = high risk, high tariff.</p>
        </div>

        {/* Demand Response Highlights */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <SectionHeader title="Demand Response Summary" />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-750 bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Total DR Available</div>
              <div className="text-lg font-bold text-cyan-400">
                {fmtMW(data.demand_response.reduce((s, r) => s + r.available_mw, 0))}
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Total MWh Curtailed</div>
              <div className="text-lg font-bold text-amber-400">
                {fmt0(data.demand_response.reduce((s, r) => s + r.total_mwh_curtailed, 0))} MWh
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Avg Payment</div>
              <div className="text-lg font-bold text-green-400">
                {fmtAUD(data.demand_response.reduce((s, r) => s + r.payment_aud_per_mwh, 0) / (data.demand_response.length || 1))}/MWh
              </div>
            </div>
            <div className="bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">Avg Reliability</div>
              <div className="text-lg font-bold text-violet-400">
                {fmtPct(data.demand_response.reduce((s, r) => s + r.reliability_pct, 0) / (data.demand_response.length || 1))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demand Response Full Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionHeader title="Demand Response Programs" />
        <DemandResponseTable records={data.demand_response} />
      </div>

    </div>
  )
}
