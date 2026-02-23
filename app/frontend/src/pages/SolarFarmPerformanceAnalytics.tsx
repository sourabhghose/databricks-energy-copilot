import { useEffect, useState } from 'react'
import { Sun } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getSolarFarmPerformanceDashboard,
  SFPDDashboard,
  SFPDFarm,
  SFPDMonthly,
  SFPDDegradation,
  SFPDFault,
  SFPDOandM,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const TECHNOLOGY_COLORS: Record<string, string> = {
  'Fixed Tilt':           '#6366f1',
  'Single-Axis Tracking': '#22c55e',
  'Dual-Axis Tracking':   '#f59e0b',
  'Bifacial':             '#06b6d4',
}

const FAULT_COLORS: string[] = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#06b6d4', '#6366f1', '#a855f7',
]

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4']

const MONTH_LABELS: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 1 — Bar: farm current_pr_pct coloured by technology, sorted descending
// ---------------------------------------------------------------------------

function FarmPRChart({ farms }: { farms: SFPDFarm[] }) {
  const data = [...farms]
    .sort((a, b) => b.current_pr_pct - a.current_pr_pct)
    .map(f => ({
      name: f.farm_name.length > 20 ? f.farm_name.slice(0, 20) + '…' : f.farm_name,
      current_pr_pct: f.current_pr_pct,
      technology: f.technology,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Farm Performance Ratio (%) by Technology — Sorted Descending
      </h3>
      <div className="flex flex-wrap gap-3 mb-3">
        {Object.entries(TECHNOLOGY_COLORS).map(([tech, colour]) => (
          <span key={tech} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: colour }} />
            {tech}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            unit="%"
            domain={[70, 90]}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(v: number, _n: string, entry: any) => [
              `${v.toFixed(1)}%`,
              `PR (${entry.payload.technology})`,
            ]}
          />
          <Bar dataKey="current_pr_pct" radius={[4, 4, 0, 0]}>
            {data.map((d, idx) => (
              <Cell key={idx} fill={TECHNOLOGY_COLORS[d.technology] ?? '#6366f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Line: monthly performance_ratio_pct trend 2024 for 5 farms
// ---------------------------------------------------------------------------

function MonthlyPRTrendChart({ monthly, farms }: { monthly: SFPDMonthly[]; farms: SFPDFarm[] }) {
  const selectedFarms = farms.slice(0, 5)
  const months = [1, 3, 5, 7, 9, 11]

  const data = months.map(m => {
    const row: Record<string, any> = { month: MONTH_LABELS[m] }
    for (const farm of selectedFarms) {
      const rec = monthly.find(r => r.farm_id === farm.farm_id && r.month === m && r.year === 2024)
      row[farm.farm_id] = rec ? rec.performance_ratio_pct : null
    }
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Monthly Performance Ratio Trend 2024 — Top 5 Farms
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[72, 90]} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(v: number) => [`${v?.toFixed(1)}%`]}
          />
          <Legend
            formatter={(value) => {
              const farm = selectedFarms.find(f => f.farm_id === value)
              return (
                <span style={{ color: '#9ca3af', fontSize: 11 }}>
                  {farm ? (farm.farm_name.length > 22 ? farm.farm_name.slice(0, 22) + '…' : farm.farm_name) : value}
                </span>
              )
            }}
          />
          {selectedFarms.map((farm, idx) => (
            <Line
              key={farm.farm_id}
              type="monotone"
              dataKey={farm.farm_id}
              stroke={LINE_COLORS[idx % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Bar: degradation yield_gap_pct by farm × operating year
// ---------------------------------------------------------------------------

function DegradationYieldGapChart({ degradation, farms }: { degradation: SFPDDegradation[]; farms: SFPDFarm[] }) {
  const farmMap = Object.fromEntries(farms.map(f => [f.farm_id, f.farm_name]))
  const farmIds = Array.from(new Set(degradation.map(d => d.farm_id)))

  const data = farmIds.map(fid => {
    const name = (farmMap[fid] ?? fid)
    const short = name.length > 18 ? name.slice(0, 18) + '…' : name
    const row: Record<string, any> = { farm: short }
    for (const yr of [1, 2, 3]) {
      const rec = degradation.find(d => d.farm_id === fid && d.year === yr)
      row[`yr${yr}`] = rec ? rec.yield_gap_pct : 0
    }
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Yield Gap (%) by Farm and Operating Year
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="farm"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, `Op Year ${name.replace('yr', '')}`]}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: '#9ca3af', fontSize: 11 }}>
                {value === 'yr1' ? 'Year 1' : value === 'yr2' ? 'Year 2' : 'Year 3'}
              </span>
            )}
          />
          <Bar dataKey="yr1" name="yr1" fill="#6366f1" radius={[2, 2, 0, 0]} />
          <Bar dataKey="yr2" name="yr2" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          <Bar dataKey="yr3" name="yr3" fill="#ef4444" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Bar: fault energy_lost_mwh coloured by fault_type (top 8 fault types)
// ---------------------------------------------------------------------------

function FaultEnergyLossChart({ faults }: { faults: SFPDFault[] }) {
  // Aggregate energy_lost_mwh by fault_type, take top 8
  const byType: Record<string, number> = {}
  for (const f of faults) {
    byType[f.fault_type] = (byType[f.fault_type] ?? 0) + f.energy_lost_mwh
  }
  const data = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ft, mwh]) => ({ fault_type: ft, energy_lost_mwh: Math.round(mwh * 10) / 10 }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Energy Lost by Fault Type (MWh) — Top 8
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 120, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MWh" />
          <YAxis
            type="category"
            dataKey="fault_type"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={120}
          />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(v: number) => [`${v.toFixed(1)} MWh`, 'Energy Lost']}
          />
          <Bar dataKey="energy_lost_mwh" radius={[0, 4, 4, 0]}>
            {data.map((_d, idx) => (
              <Cell key={idx} fill={FAULT_COLORS[idx % FAULT_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Bar: quarterly o_and_m_cost_k_aud trend by farm
// ---------------------------------------------------------------------------

function OandMCostChart({ o_and_m, farms }: { o_and_m: SFPDOandM[]; farms: SFPDFarm[] }) {
  const farmIds = Array.from(new Set(o_and_m.map(r => r.farm_id)))
  const farmMap = Object.fromEntries(farms.map(f => [f.farm_id, f.farm_name]))

  // Build quarterly timeline
  const quarters: string[] = []
  for (const yr of [2022, 2023, 2024]) {
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
      quarters.push(`${yr}-${q}`)
    }
  }

  const data = quarters.map(qLabel => {
    const [yrStr, q] = qLabel.split('-')
    const yr = parseInt(yrStr, 10)
    const row: Record<string, any> = { quarter: qLabel.replace('-', ' ') }
    for (const fid of farmIds) {
      const rec = o_and_m.find(r => r.farm_id === fid && r.year === yr && r.quarter === q)
      row[fid] = rec ? rec.o_and_m_cost_k_aud : 0
    }
    return row
  })

  const farmColors = ['#22c55e', '#6366f1']

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Quarterly O&amp;M Cost by Farm ($k AUD) — 2022–2024
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="quarter"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="k" />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(v: number, name: string) => [`$${v.toFixed(1)}k AUD`, farmMap[name] ?? name]}
          />
          <Legend
            formatter={(value) => {
              const name = farmMap[value] ?? value
              return (
                <span style={{ color: '#9ca3af', fontSize: 11 }}>
                  {name.length > 24 ? name.slice(0, 24) + '…' : name}
                </span>
              )
            }}
          />
          {farmIds.map((fid, idx) => (
            <Bar
              key={fid}
              dataKey={fid}
              stackId="a"
              fill={farmColors[idx % farmColors.length]}
              radius={idx === farmIds.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SolarFarmPerformanceAnalytics() {
  const [data, setData] = useState<SFPDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSolarFarmPerformanceDashboard()
      .then(setData)
      .catch(err => setError(err.message ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <span className="text-gray-400 text-sm animate-pulse">Loading Solar Farm Performance data…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <span className="text-red-400 text-sm">{error ?? 'No data available'}</span>
      </div>
    )
  }

  const { farms, monthly, degradation, faults, o_and_m, summary } = data

  return (
    <div className="min-h-screen bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <Sun className="text-amber-400" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Solar Farm Performance &amp; Degradation Analytics</h1>
          <p className="text-sm text-gray-400">
            Australian utility-scale solar — Performance ratio, degradation, faults &amp; O&amp;M
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Farms"
          value={`${summary.total_farms}`}
          sub="Utility-scale AU solar"
        />
        <KpiCard
          label="Total Capacity"
          value={`${summary.total_capacity_gw.toFixed(2)} GW`}
          sub="DC nameplate (GW)"
        />
        <KpiCard
          label="Avg Performance Ratio"
          value={`${summary.avg_performance_ratio_pct.toFixed(1)}%`}
          sub="Fleet average PR"
        />
        <KpiCard
          label="Avg Degradation Rate"
          value={`${summary.avg_degradation_rate_pct.toFixed(3)}%/yr`}
          sub="Fleet average annual deg."
        />
      </div>

      {/* Additional summary banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Total Energy 2024</span>
          <p className="text-2xl font-bold text-white mt-1">{summary.total_energy_2024_gwh.toFixed(1)} GWh</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Best Performing Farm</span>
          <p className="text-lg font-bold text-amber-400 mt-1">{summary.best_performing_farm}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Avg Availability</span>
          <p className="text-2xl font-bold text-white mt-1">{summary.avg_availability_pct.toFixed(1)}%</p>
        </div>
      </div>

      {/* Chart 1 & 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <FarmPRChart farms={farms} />
        <MonthlyPRTrendChart monthly={monthly} farms={farms} />
      </div>

      {/* Chart 3 & 4 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DegradationYieldGapChart degradation={degradation} farms={farms} />
        <FaultEnergyLossChart faults={faults} />
      </div>

      {/* Chart 5 */}
      <OandMCostChart o_and_m={o_and_m} farms={farms} />
    </div>
  )
}
