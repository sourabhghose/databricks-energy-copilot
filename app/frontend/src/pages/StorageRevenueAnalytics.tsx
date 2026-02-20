// Sprint 69b: Energy Storage Revenue Stack Analytics
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts'
import { BatteryCharging, TrendingUp, Zap, DollarSign, Award } from 'lucide-react'
import {
  getStorageRevenueDashboard,
  ESRDashboard,
  ESRRevenueStreamRecord,
  ESRDegradationRecord,
  ESRSensitivityRecord,
  ESRProjectRecord,
} from '../api/client'

// ── Colour palettes ────────────────────────────────────────────────────────────
const REVENUE_COLOURS: Record<string, string> = {
  energy_arbitrage_per_kw:    '#3b82f6',
  fcas_raise_per_kw:          '#10b981',
  fcas_lower_per_kw:          '#06b6d4',
  capacity_payment_per_kw:    '#f59e0b',
  firm_power_contract_per_kw: '#8b5cf6',
  ancillary_other_per_kw:     '#ec4899',
}

const TECH_COLOURS: Record<string, string> = {
  LFP:      '#3b82f6',
  NMC:      '#8b5cf6',
  VRFB:     '#10b981',
  ZINC_AIR: '#f97316',
}

const TECH_BADGES: Record<string, string> = {
  LFP:      'bg-blue-500/20 text-blue-400',
  NMC:      'bg-purple-500/20 text-purple-400',
  VRFB:     'bg-emerald-500/20 text-emerald-400',
  ZINC_AIR: 'bg-orange-500/20 text-orange-400',
}

// ── KPI card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
}
function KpiCard({ label, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-4 border border-gray-700">
      <div className={`p-3 rounded-lg ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

// ── Revenue Stack Chart ───────────────────────────────────────────────────────
const STACKED_KEYS = [
  { key: 'energy_arbitrage_per_kw',    label: 'Energy Arbitrage' },
  { key: 'fcas_raise_per_kw',          label: 'FCAS Raise'       },
  { key: 'fcas_lower_per_kw',          label: 'FCAS Lower'       },
  { key: 'capacity_payment_per_kw',    label: 'Capacity Payment' },
  { key: 'firm_power_contract_per_kw', label: 'Firm Contract'    },
  { key: 'ancillary_other_per_kw',     label: 'Ancillary Other'  },
]

function RevenueStackChart({ streams }: { streams: ESRRevenueStreamRecord[] }) {
  const [year, setYear] = useState<2024 | 2025>(2024)
  const filtered = streams.filter(s => s.year === year)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Revenue Stack by Project ($/kW/yr)</h2>
        <div className="flex gap-1">
          {([2024, 2025] as const).map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                year === y
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="project_name"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/kW" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 11, color: '#9ca3af' }} />
          {STACKED_KEYS.map(({ key, label }) => (
            <Bar key={key} dataKey={key} name={label} stackId="rev" fill={REVENUE_COLOURS[key]} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Merchant vs Contracted mini split */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-400 mb-3">Merchant vs Contracted Revenue Split</p>
        <div className="flex flex-wrap gap-3">
          {filtered.map(s => (
            <div key={s.project_name} className="flex-1 min-w-[140px]">
              <p className="text-xs text-gray-400 mb-1 truncate">{s.project_name.split(' ').slice(0, 2).join(' ')}</p>
              <div className="flex rounded overflow-hidden h-4">
                <div
                  style={{ width: `${s.merchant_pct}%`, backgroundColor: '#3b82f6' }}
                  title={`Merchant ${s.merchant_pct}%`}
                />
                <div
                  style={{ width: `${s.contracted_pct}%`, backgroundColor: '#8b5cf6' }}
                  title={`Contracted ${s.contracted_pct}%`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                <span>{s.merchant_pct}% M</span>
                <span>{s.contracted_pct}% C</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Merchant
          </span>
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" /> Contracted
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Projects Table ────────────────────────────────────────────────────────────
function irrColor(irr: number): string {
  if (irr >= 15) return 'text-emerald-400'
  if (irr >= 10) return 'text-yellow-400'
  return 'text-red-400'
}

function ProjectsTable({ projects }: { projects: ESRProjectRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-white mb-4">BESS Project Register</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-300 min-w-[900px]">
          <thead>
            <tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Project</th>
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Technology</th>
              <th className="text-right py-2 pr-3">MW / MWh / hr</th>
              <th className="text-right py-2 pr-3">Capex ($/kW)</th>
              <th className="text-right py-2 pr-3">Cycles/yr</th>
              <th className="text-right py-2 pr-3">Deg (%/yr)</th>
              <th className="text-right py-2 pr-3">IRR (%)</th>
              <th className="text-right py-2">NPV ($M)</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.project_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-3 font-medium text-white">{p.project_name}</td>
                <td className="py-2 pr-3">
                  <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300">{p.region}</span>
                </td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TECH_BADGES[p.technology] ?? 'bg-gray-700 text-gray-300'}`}>
                    {p.technology}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">
                  {p.capacity_mw} / {p.energy_mwh} / {p.duration_hr}
                </td>
                <td className="py-2 pr-3 text-right">${p.capex_per_kw.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right">{p.cycles_per_year}</td>
                <td className="py-2 pr-3 text-right">{p.degradation_pct_per_yr}%</td>
                <td className={`py-2 pr-3 text-right font-semibold ${irrColor(p.irr_pct)}`}>
                  {p.irr_pct.toFixed(1)}%
                </td>
                <td className="py-2 text-right">${p.npv_m}M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Degradation Curves ────────────────────────────────────────────────────────
const TECH_OPTIONS = ['LFP', 'NMC', 'VRFB', 'ZINC_AIR'] as const
type TechOption = typeof TECH_OPTIONS[number]

function DegradationCurves({ degradation }: { degradation: ESRDegradationRecord[] }) {
  const [tech, setTech] = useState<TechOption>('LFP')
  const data = degradation.filter(d => d.technology === tech)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Battery Degradation Curves</h2>
        <div className="flex gap-1 flex-wrap">
          {TECH_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => setTech(t)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                tech === t
                  ? 'text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              style={tech === t ? { backgroundColor: TECH_COLOURS[t] } : {}}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Year', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 11 }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            domain={[60, 105]}
            unit="%"
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6', fontSize: 11 }}
            itemStyle={{ fontSize: 11 }}
            formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            labelFormatter={(l: number) => `Year ${l}`}
          />
          <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11, color: '#9ca3af' }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="capacity_retention_pct"
            name="Capacity Retention (%)"
            stroke={TECH_COLOURS[tech]}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="round_trip_efficiency_pct"
            name="Round-Trip Efficiency (%)"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {data.length > 0 && (
          <>
            <div className="bg-gray-700/40 rounded-lg p-3">
              <p className="text-xs text-gray-400">Year 10 Capacity</p>
              <p className="text-lg font-bold text-white">
                {data.find(d => d.year === 10)?.capacity_retention_pct.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-700/40 rounded-lg p-3">
              <p className="text-xs text-gray-400">Replacement Cost ($/kWh)</p>
              <p className="text-lg font-bold text-white">
                ${data[0]?.replacement_cost_per_kwh}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── IRR Sensitivity Tornado Chart ─────────────────────────────────────────────
interface TornadoEntry {
  variable: string
  delta_pct: number
  irr_delta_pct: number
  npv_delta_m: number
}

function buildTornadoData(sensitivity: ESRSensitivityRecord[]): TornadoEntry[] {
  // Group by variable, pick the max-abs delta entry for ordering, keep both directions
  const byVar: Record<string, ESRSensitivityRecord[]> = {}
  sensitivity.forEach(s => {
    if (!byVar[s.variable]) byVar[s.variable] = []
    byVar[s.variable].push(s)
  })
  // Flatten and sort by absolute irr_delta_pct descending
  const flat: TornadoEntry[] = sensitivity.map(s => ({
    variable: s.variable,
    delta_pct: s.delta_pct,
    irr_delta_pct: s.irr_delta_pct,
    npv_delta_m: s.npv_delta_m,
  }))
  // Deduplicate for display: one bar per (variable, direction) but sorted by |irr_delta|
  flat.sort((a, b) => Math.abs(b.irr_delta_pct) - Math.abs(a.irr_delta_pct))
  return flat
}

const TornadoTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: TornadoEntry }> }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs">
      <p className="text-white font-semibold">{d.variable}</p>
      <p className="text-gray-400">Change: {d.delta_pct > 0 ? '+' : ''}{d.delta_pct}%</p>
      <p style={{ color: d.irr_delta_pct >= 0 ? '#10b981' : '#ef4444' }}>
        IRR impact: {d.irr_delta_pct > 0 ? '+' : ''}{d.irr_delta_pct.toFixed(1)}%
      </p>
      <p className="text-gray-400">NPV impact: ${d.npv_delta_m}M</p>
    </div>
  )
}

function TornadoChart({ sensitivity }: { sensitivity: ESRSensitivityRecord[] }) {
  const data = buildTornadoData(sensitivity)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-white mb-1">IRR Sensitivity Tornado — Origin BESS NSW (BESS004)</h2>
      <p className="text-xs text-gray-500 mb-4">Base IRR: 12.5% — sorted by absolute IRR impact</p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            unit="%"
            domain={['dataMin - 0.5', 'dataMax + 0.5']}
          />
          <YAxis
            type="category"
            dataKey="variable"
            tick={{ fill: '#d1d5db', fontSize: 11 }}
            width={135}
          />
          <Tooltip content={<TornadoTooltip />} />
          <Bar dataKey="irr_delta_pct" name="IRR Delta (%)" radius={[0, 3, 3, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.irr_delta_pct >= 0 ? '#10b981' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Revenue Mix Donut ─────────────────────────────────────────────────────────
function MerchantContractedDonut({ streams }: { streams: ESRRevenueStreamRecord[] }) {
  const y2024 = streams.filter(s => s.year === 2024)
  if (!y2024.length) return null

  const totalMerchant = y2024.reduce((a, s) => a + (s.total_revenue_per_kw * s.merchant_pct) / 100, 0)
  const totalContracted = y2024.reduce((a, s) => a + (s.total_revenue_per_kw * s.contracted_pct) / 100, 0)
  const total = totalMerchant + totalContracted

  const donutData = [
    { name: 'Merchant', value: Math.round(totalMerchant), color: '#3b82f6' },
    { name: 'Contracted', value: Math.round(totalContracted), color: '#8b5cf6' },
  ]

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-white mb-4">Portfolio Revenue Mix (2024, $/kW weighted)</h2>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              dataKey="value"
              stroke="none"
            >
              {donutData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => [`$${v}/kW (${((v / total) * 100).toFixed(0)}%)`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-3">
          {donutData.map(d => (
            <div key={d.name} className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <div>
                <p className="text-xs text-gray-300 font-medium">{d.name}</p>
                <p className="text-base font-bold text-white">${d.value}/kW</p>
                <p className="text-xs text-gray-500">{((d.value / total) * 100).toFixed(0)}% of total</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StorageRevenueAnalytics() {
  const [data, setData] = useState<ESRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStorageRevenueDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <p className="text-red-400 text-sm">{error ?? 'No data available'}</p>
      </div>
    )
  }

  const s = data.summary as Record<string, string | number>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600/20 rounded-lg">
          <BatteryCharging className="text-blue-400" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Energy Storage Revenue Stack Analytics</h1>
          <p className="text-xs text-gray-400">BESS revenue streams, degradation economics &amp; IRR sensitivity</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Portfolio Capacity"
          value={`${s.total_capacity_gw} GW`}
          sub={`${s.total_energy_gwh} GWh energy`}
          icon={<Zap size={18} className="text-blue-400" />}
          accent="bg-blue-500/10"
        />
        <KpiCard
          label="Portfolio Avg IRR"
          value={`${s.avg_irr_pct}%`}
          sub={`${s.total_projects} projects tracked`}
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          accent="bg-emerald-500/10"
        />
        <KpiCard
          label="Best IRR Project"
          value="22.0%"
          sub={`${s.best_irr_project}`}
          icon={<Award size={18} className="text-yellow-400" />}
          accent="bg-yellow-500/10"
        />
        <KpiCard
          label="Highest Revenue/kW"
          value={`$${s.highest_revenue_per_kw}/kW`}
          sub={`Region: ${s.highest_revenue_region}`}
          icon={<DollarSign size={18} className="text-purple-400" />}
          accent="bg-purple-500/10"
        />
      </div>

      {/* Revenue Stack Chart */}
      <RevenueStackChart streams={data.revenue_streams} />

      {/* Merchant/Contracted Donut + Degradation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MerchantContractedDonut streams={data.revenue_streams} />
        <DegradationCurves degradation={data.degradation} />
      </div>

      {/* Projects Table */}
      <ProjectsTable projects={data.projects} />

      {/* Tornado Chart */}
      <TornadoChart sensitivity={data.sensitivity} />
    </div>
  )
}
