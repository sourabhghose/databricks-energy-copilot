import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import {
  getSystemLoadBalancingDashboard,
  SLBDashboard,
  SLBReserveRecord,
  SLBPASARecord,
  SLBDemandGrowthRecord,
  SLBNewCapacityRecord,
  SLBReliabilityEventRecord,
} from '../api/client'

// ── Colour palette ───────────────────────────────────────────────────────────
const COLORS = {
  NSW1: '#60a5fa',
  VIC1: '#34d399',
  QLD1: '#fbbf24',
  SA1:  '#f87171',
  TAS1: '#a78bfa',
  SUMMER: '#f97316',
  AUTUMN: '#a3e635',
  WINTER: '#38bdf8',
  SPRING: '#fb7185',
  CENTRAL: '#60a5fa',
  HIGH:    '#f87171',
  LOW:     '#34d399',
  committed: '#60a5fa',
  probable:  '#fbbf24',
  potential: '#34d399',
  retirement:'#f87171',
}

const REGION_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa']

const lorBadge = (risk: string) => {
  const map: Record<string, string> = {
    LOR1: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    LOR2: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
    LOR3: 'bg-red-500/20 text-red-300 border border-red-500/40',
    NONE: 'bg-green-500/20 text-green-300 border border-green-500/40',
  }
  return map[risk] ?? 'bg-slate-700 text-slate-300'
}

const eventTypeBadge = (type: string) => {
  const map: Record<string, string> = {
    LOR1: 'bg-yellow-500/20 text-yellow-300',
    LOR2: 'bg-orange-500/20 text-orange-300',
    LOR3: 'bg-red-600/20 text-red-300',
    LOAD_SHEDDING: 'bg-red-700/20 text-red-200',
    RERT_ACTIVATED: 'bg-purple-500/20 text-purple-300',
    NEAR_MISS: 'bg-slate-500/20 text-slate-300',
  }
  return map[type] ?? 'bg-slate-700 text-slate-300'
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
interface KPIProps { label: string; value: string | number; sub?: string; accent?: string }
function KPICard({ label, value, sub, accent = 'text-blue-400' }: KPIProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Reserve Margins Bar Chart ─────────────────────────────────────────────────
function ReserveMarginsChart({ records }: { records: SLBReserveRecord[] }) {
  const [selectedYear, setSelectedYear] = useState<number>(2024)
  const [selectedSeason, setSelectedSeason] = useState<string>('SUMMER')

  const filtered = records.filter(r => r.year === selectedYear && r.season === selectedSeason)
  const chartData = filtered.map(r => ({
    region: r.region,
    'Reserve Margin %': r.reserve_margin_pct,
    'Min Standard %': r.minimum_reserve_standard_pct,
  }))

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <SectionHeading
        title="Reserve Margins by Region"
        sub="Firm capacity reserve margin vs regulatory minimum (15%) — coloured bars below threshold indicate risk"
      />
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {[2023, 2024].map(yr => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedYear === yr
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {['SUMMER', 'AUTUMN', 'WINTER', 'SPRING'].map(s => (
            <button
              key={s}
              onClick={() => setSelectedSeason(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedSeason === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="region" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" domain={[0, 35]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#f1f5f9' }}
            formatter={(v: number) => [`${v.toFixed(2)}%`]}
          />
          <Legend wrapperStyle={{ color: '#94a3b8' }} />
          <ReferenceLine y={15} stroke="#f87171" strokeDasharray="6 3" label={{ value: 'Min 15%', fill: '#f87171', fontSize: 11 }} />
          <Bar dataKey="Reserve Margin %" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry['Reserve Margin %'] >= 15 ? REGION_COLORS[idx] : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Reserve gap table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left pb-2">Region</th>
              <th className="text-right pb-2">Peak (MW)</th>
              <th className="text-right pb-2">Firm Cap (MW)</th>
              <th className="text-right pb-2">Margin %</th>
              <th className="text-right pb-2">Gap (MW)</th>
              <th className="text-right pb-2">USE (MWh)</th>
              <th className="text-right pb-2">LOLP %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="py-1.5 font-medium">{r.region}</td>
                <td className="py-1.5 text-right">{r.peak_demand_mw.toLocaleString()}</td>
                <td className="py-1.5 text-right">{r.firm_capacity_mw.toLocaleString()}</td>
                <td className={`py-1.5 text-right font-semibold ${r.reserve_margin_pct >= 15 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.reserve_margin_pct.toFixed(1)}%
                </td>
                <td className={`py-1.5 text-right ${r.reserve_gap_mw >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.reserve_gap_mw >= 0 ? '+' : ''}{r.reserve_gap_mw.toLocaleString()}
                </td>
                <td className="py-1.5 text-right">{r.unserved_energy_mwh.toFixed(4)}</td>
                <td className="py-1.5 text-right">{r.loss_of_load_probability_pct.toFixed(3)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── PASA Assessment Table ─────────────────────────────────────────────────────
function PASAAssessmentTable({ records }: { records: SLBPASARecord[] }) {
  const [selectedHorizon, setSelectedHorizon] = useState<number>(4)

  const filtered = records.filter(r => r.forecast_horizon_weeks === selectedHorizon)

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <SectionHeading
        title="PASA Assessment — Projected Available System Adequacy"
        sub="Probability of Exceedance (POE) forecasts with LOR risk classification"
      />
      <div className="flex gap-2 mb-4">
        {[4, 52].map(h => (
          <button
            key={h}
            onClick={() => setSelectedHorizon(h)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedHorizon === h
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {h === 4 ? '4-Week Horizon' : '52-Week Horizon'}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left pb-2">Region</th>
              <th className="text-left pb-2">POE</th>
              <th className="text-right pb-2">Peak Forecast (MW)</th>
              <th className="text-right pb-2">Available Gen (MW)</th>
              <th className="text-right pb-2">Proj Reserve (MW)</th>
              <th className="text-left pb-2 pl-3">LOR Risk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="py-2 font-medium">{r.region}</td>
                <td className="py-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {r.probability_of_exceedance}
                  </span>
                </td>
                <td className="py-2 text-right">{r.peak_demand_forecast_mw.toLocaleString()}</td>
                <td className="py-2 text-right">{r.available_generation_mw.toLocaleString()}</td>
                <td className={`py-2 text-right font-semibold ${r.projected_reserve_margin_mw >= 800 ? 'text-green-400' : r.projected_reserve_margin_mw >= 400 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {r.projected_reserve_margin_mw.toLocaleString()}
                </td>
                <td className="py-2 pl-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${lorBadge(r.lor_risk)}`}>
                    {r.lor_risk}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Demand Growth Scenarios Line Chart ────────────────────────────────────────
function DemandGrowthChart({ records }: { records: SLBDemandGrowthRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState<string>('NSW1')

  const filtered = records.filter(r => r.region === selectedRegion)
  const byScenario: Record<string, SLBDemandGrowthRecord[]> = {}
  filtered.forEach(r => {
    if (!byScenario[r.scenario]) byScenario[r.scenario] = []
    byScenario[r.scenario].push(r)
  })

  const years = [2025, 2030, 2035]
  const chartData = years.map(yr => {
    const row: Record<string, number | string> = { year: yr.toString() }
    Object.entries(byScenario).forEach(([scen, recs]) => {
      const rec = recs.find(r => r.year === yr)
      if (rec) {
        row[`${scen} Max (MW)`] = rec.annual_max_demand_mw
        row[`${scen} Summer (MW)`] = rec.summer_peak_mw
      }
    })
    return row
  })

  const evData = years.map(yr => {
    const row: Record<string, number | string> = { year: yr.toString() }
    filtered.filter(r => r.year === yr).forEach(r => {
      row[`${r.scenario} EV Load`] = r.ev_load_mw
      row[`${r.scenario} Ind Elec`] = r.industrial_electrification_mw
    })
    return row
  })

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <SectionHeading
        title="Demand Growth Scenarios"
        sub="Annual maximum demand projections by scenario (CENTRAL / HIGH / LOW) with EV and industrial electrification breakdown"
      />
      <div className="flex gap-1 mb-5 flex-wrap">
        {['NSW1', 'VIC1', 'QLD1', 'SA1', 'TAS1'].map(reg => (
          <button
            key={reg}
            onClick={() => setSelectedRegion(reg)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedRegion === reg
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {reg}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Demand projections */}
        <div>
          <p className="text-xs text-slate-400 mb-2">Annual Maximum Demand (MW)</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f1f5f9' }}
                formatter={(v: number) => [v.toLocaleString() + ' MW']}
              />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
              {['CENTRAL', 'HIGH', 'LOW'].map(scen => (
                <Line
                  key={scen}
                  type="monotone"
                  dataKey={`${scen} Max (MW)`}
                  stroke={COLORS[scen as keyof typeof COLORS]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* EV + Industrial Electrification */}
        <div>
          <p className="text-xs text-slate-400 mb-2">EV Load & Industrial Electrification (MW)</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f1f5f9' }}
                formatter={(v: number) => [v.toLocaleString() + ' MW']}
              />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
              {['CENTRAL', 'HIGH', 'LOW'].map(scen => (
                <Line
                  key={`ev-${scen}`}
                  type="monotone"
                  dataKey={`${scen} EV Load`}
                  stroke={COLORS[scen as keyof typeof COLORS]}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── New Capacity Pipeline Stacked Bar ─────────────────────────────────────────
function NewCapacityPipelineChart({ records }: { records: SLBNewCapacityRecord[] }) {
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL')

  const filtered = selectedRegion === 'ALL'
    ? records
    : records.filter(r => r.region === selectedRegion)

  // Aggregate by year
  const byYear: Record<number, { committed: number; probable: number; potential: number; retirement: number }> = {}
  filtered.forEach(r => {
    if (!byYear[r.year]) byYear[r.year] = { committed: 0, probable: 0, potential: 0, retirement: 0 }
    byYear[r.year].committed += r.committed_capacity_mw
    byYear[r.year].probable += r.probable_capacity_mw
    byYear[r.year].potential += r.potential_capacity_mw
    byYear[r.year].retirement += r.retirement_capacity_mw
  })

  const chartData = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([yr, vals]) => ({
      year: yr,
      Committed: Math.round(vals.committed),
      Probable: Math.round(vals.probable),
      Potential: Math.round(vals.potential),
      Retirements: -Math.round(vals.retirement),
    }))

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <SectionHeading
        title="New Capacity Pipeline"
        sub="Committed, probable, and potential capacity additions vs retirements by year"
      />
      <div className="flex gap-1 mb-4 flex-wrap">
        {['ALL', 'NSW1', 'VIC1', 'QLD1', 'SA1', 'TAS1'].map(reg => (
          <button
            key={reg}
            onClick={() => setSelectedRegion(reg)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedRegion === reg
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {reg}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit=" MW" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#f1f5f9' }}
            formatter={(v: number) => [Math.abs(v).toLocaleString() + ' MW']}
          />
          <Legend wrapperStyle={{ color: '#94a3b8' }} />
          <ReferenceLine y={0} stroke="#475569" />
          <Bar dataKey="Committed" stackId="a" fill={COLORS.committed} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Probable" stackId="a" fill={COLORS.probable} />
          <Bar dataKey="Potential" stackId="a" fill={COLORS.potential} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Retirements" stackId="b" fill={COLORS.retirement} radius={[0, 0, 4, 4]} />
        </BarChart>
      </ResponsiveContainer>
      {/* Tech mix table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left pb-2">Region</th>
              <th className="text-left pb-2">Dominant Technology</th>
              <th className="text-right pb-2">2024 Committed (MW)</th>
              <th className="text-right pb-2">2024 Retirements (MW)</th>
              <th className="text-right pb-2">Net Change (MW)</th>
            </tr>
          </thead>
          <tbody>
            {records
              .filter(r => r.year === 2024)
              .map((r, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="py-1.5 font-medium">{r.region}</td>
                  <td className="py-1.5">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                      {r.technology_mix}
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-green-400">{r.committed_capacity_mw.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-red-400">{r.retirement_capacity_mw.toLocaleString()}</td>
                  <td className={`py-1.5 text-right font-semibold ${r.net_capacity_change_mw >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {r.net_capacity_change_mw >= 0 ? '+' : ''}{r.net_capacity_change_mw.toLocaleString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Reliability Events Table ──────────────────────────────────────────────────
function ReliabilityEventsTable({ records }: { records: SLBReliabilityEventRecord[] }) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <SectionHeading
        title="Reliability Events (2021-2024)"
        sub="LOR declarations, load shedding events, RERT activations, and near-miss incidents"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left pb-2">Date</th>
              <th className="text-left pb-2">Region</th>
              <th className="text-left pb-2">Event Type</th>
              <th className="text-left pb-2">Cause</th>
              <th className="text-right pb-2">Duration (hrs)</th>
              <th className="text-right pb-2">MW at Risk</th>
              <th className="text-right pb-2">MW Shed</th>
              <th className="text-right pb-2">Cost ($M)</th>
              <th className="text-left pb-2 pl-3">Resolution</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="py-2 font-mono">{r.date}</td>
                <td className="py-2 font-medium">{r.region}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${eventTypeBadge(r.event_type)}`}>
                    {r.event_type.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2 text-slate-400">{r.cause.replace(/_/g, ' ')}</td>
                <td className="py-2 text-right">{r.duration_hrs.toFixed(1)}</td>
                <td className="py-2 text-right text-orange-300">{r.mw_at_risk.toLocaleString()}</td>
                <td className={`py-2 text-right ${r.mw_shed > 0 ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
                  {r.mw_shed > 0 ? r.mw_shed.toLocaleString() : '—'}
                </td>
                <td className="py-2 text-right text-yellow-300">${r.cost_m.toFixed(1)}M</td>
                <td className="py-2 pl-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                    {r.resolution.replace(/_/g, ' ')}
                  </span>
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
export default function SystemLoadBalancingAnalytics() {
  const [data, setData] = useState<SLBDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSystemLoadBalancingDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message ?? 'Failed to load dashboard'); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-sm">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const { summary } = data
  const avgReserve = summary.avg_reserve_margin_pct as number
  const regionsBelowStd = summary.regions_below_minimum_standard as number
  const lorEvents = summary.total_lor_events_2024 as number
  const newCap = summary.total_new_capacity_2024_mw as number
  const highDemandReg = summary.highest_demand_growth_region as string
  const useMet = summary.unserved_energy_target_met as boolean

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          NEM System Load Balancing & Reserve Adequacy Analytics
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Reserve margins, reliability standards, PASA assessments, demand growth forecasts, and system security gap analysis
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KPICard
          label="Avg Reserve Margin"
          value={`${avgReserve}%`}
          sub="NEM-wide average"
          accent={avgReserve >= 15 ? 'text-green-400' : 'text-red-400'}
        />
        <KPICard
          label="Regions Below Standard"
          value={regionsBelowStd}
          sub="Below 15% minimum"
          accent={regionsBelowStd === 0 ? 'text-green-400' : 'text-red-400'}
        />
        <KPICard
          label="LOR Events 2024"
          value={lorEvents}
          sub="All LOR1/2/3 levels"
          accent="text-orange-400"
        />
        <KPICard
          label="New Capacity 2024"
          value={`${newCap.toLocaleString()} MW`}
          sub="Committed additions"
          accent="text-blue-400"
        />
        <KPICard
          label="Highest Growth Region"
          value={highDemandReg}
          sub="Central scenario"
          accent="text-yellow-400"
        />
        <KPICard
          label="USE Target Met"
          value={useMet ? 'Yes' : 'No'}
          sub="< 0.002% threshold"
          accent={useMet ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-6">
        <ReserveMarginsChart records={data.reserves} />
        <PASAAssessmentTable records={data.pasa} />
        <DemandGrowthChart records={data.demand_growth} />
        <NewCapacityPipelineChart records={data.new_capacity} />
        <ReliabilityEventsTable records={data.reliability_events} />
      </div>
    </div>
  )
}
