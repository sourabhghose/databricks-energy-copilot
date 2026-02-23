import { useEffect, useState } from 'react'
import { Factory } from 'lucide-react'
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
  getIndustrialEnergyEfficiencyDashboard,
  INEEDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const SECTOR_COLORS: Record<string, string> = {
  'Aluminium':       '#6366f1',
  'Steel':           '#f97316',
  'Cement':          '#f59e0b',
  'Mining':          '#84cc16',
  'Chemical':        '#06b6d4',
  'Food & Beverage': '#ec4899',
  'Paper':           '#8b5cf6',
  'Glass':           '#14b8a6',
  'Plastics':        '#f43f5e',
  'Refining':        '#22c55e',
}

const PROJECT_TYPE_COLORS: Record<string, string> = {
  'Motor Efficiency':       '#6366f1',
  'Compressed Air':         '#22c55e',
  'Heat Recovery':          '#f97316',
  'Lighting':               '#f59e0b',
  'HVAC':                   '#06b6d4',
  'Process Optimisation':   '#ec4899',
  'Fuel Switch':            '#8b5cf6',
  'Cogeneration':           '#14b8a6',
  'Solar PV':               '#f43f5e',
  'Variable Speed Drive':   '#84cc16',
}

const TREND_LINE_COLORS = ['#6366f1', '#22c55e', '#f97316']

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
// Main page
// ---------------------------------------------------------------------------

export default function IndustrialEnergyEfficiencyAnalytics() {
  const [data, setData] = useState<INEEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getIndustrialEnergyEfficiencyDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-400 text-lg">Loading Industrial Energy Efficiency data…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-red-400 text-lg">Error: {error ?? 'No data'}</span>
      </div>
    )
  }

  const { facilities, projects, programs, benchmarks, trends, summary } = data

  // Chart 1 — facilities sorted descending by annual_energy_tj
  const facilityEnergyData = [...facilities]
    .sort((a, b) => b.annual_energy_tj - a.annual_energy_tj)
    .map(f => ({
      name: f.facility_name.length > 22 ? f.facility_name.slice(0, 22) + '…' : f.facility_name,
      annual_energy_tj: f.annual_energy_tj,
      sector: f.industry_sector,
    }))

  // Chart 2 — top 20 projects by energy_saving_tj_pa
  const top20Projects = [...projects]
    .sort((a, b) => b.energy_saving_tj_pa - a.energy_saving_tj_pa)
    .slice(0, 20)
    .map(p => ({
      name: p.project_id,
      energy_saving_tj_pa: p.energy_saving_tj_pa,
      type: p.project_type,
    }))

  // Chart 3 — program energy saved vs target
  const programData = programs.map(p => ({
    name: p.program_name.length > 28 ? p.program_name.slice(0, 28) + '…' : p.program_name,
    energy_saving_target_pj: p.energy_saving_target_pj,
    energy_saved_pj: p.energy_saved_pj,
  }))

  // Chart 4 — benchmark Australia vs global best (latest year = 2024, metric = Energy Intensity)
  const benchmarkData = benchmarks
    .filter(b => b.year === 2024 && b.metric === 'Energy Intensity')
    .map(b => ({
      sector: b.industry_sector,
      australia_value: b.australia_value,
      global_best_value: b.global_best_value,
    }))

  // Chart 5 — quarterly EET score trend for 3 facilities
  const trendFacilityIds = Array.from(new Set(trends.map(t => t.facility_id)))
  const trendLabels = trends
    .filter(t => t.facility_id === trendFacilityIds[0])
    .map(t => `${t.year}-${t.quarter}`)

  const trendChartData = trendLabels.map((label, idx) => {
    const row: Record<string, string | number> = { label }
    trendFacilityIds.forEach(fid => {
      const entry = trends
        .filter(t => t.facility_id === fid)
        [idx]
      if (entry) row[fid] = entry.eet_score
    })
    return row
  })

  // Map facility_id to a short display name
  const facilityShortName: Record<string, string> = {}
  trendFacilityIds.forEach(fid => {
    const fac = facilities.find(f => f.facility_id === fid)
    facilityShortName[fid] = fac
      ? fac.facility_name.split(' ').slice(0, 2).join(' ')
      : fid
  })

  return (
    <div className="min-h-screen bg-gray-900 p-6 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Factory className="w-8 h-8 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Industrial Energy Efficiency Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australian industrial energy efficiency programs, facilities and benchmarks (INEE)
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Total Facilities"
          value={summary.total_facilities.toString()}
          sub="NGER / Safeguard reporters"
        />
        <KpiCard
          label="Total Annual Energy"
          value={`${summary.total_annual_energy_tj.toLocaleString()} TJ`}
          sub="Across all facilities"
        />
        <KpiCard
          label="Avg EET Score"
          value={summary.avg_eet_score.toFixed(1)}
          sub="Energy Efficiency Tracker (0-100)"
        />
        <KpiCard
          label="Total CO2 Reduction"
          value={`${summary.total_co2_reduction_kt_pa.toFixed(1)} ktpa`}
          sub="From efficiency projects"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Chart 1 — Facility Annual Energy by Sector */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-4">
            Facility Annual Energy Consumption (TJ) — by Sector
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={facilityEnergyData} layout="vertical" margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={155} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(val: number) => [`${val.toLocaleString()} TJ`, 'Annual Energy']}
              />
              <Bar dataKey="annual_energy_tj" name="Annual Energy TJ" radius={[0, 3, 3, 0]}>
                {facilityEnergyData.map((entry, idx) => (
                  <Cell key={idx} fill={SECTOR_COLORS[entry.sector] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2 — Project Energy Savings by Type */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-4">
            Top 20 Projects — Energy Saving (TJ/pa) by Type
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top20Projects} margin={{ left: 4, right: 20, top: 4, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(val: number) => [`${val.toFixed(2)} TJ/pa`, 'Energy Saving']}
              />
              <Bar dataKey="energy_saving_tj_pa" name="Energy Saving TJ/pa" radius={[3, 3, 0, 0]}>
                {top20Projects.map((entry, idx) => (
                  <Cell key={idx} fill={PROJECT_TYPE_COLORS[entry.type] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3 — Program Energy Saved vs Target */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-4">
            Program Energy Saved vs Target (PJ)
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={programData} margin={{ left: 4, right: 20, top: 4, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
              <Bar dataKey="energy_saving_target_pj" name="Target (PJ)" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="energy_saved_pj" name="Saved (PJ)" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4 — Benchmark Australia vs Global Best */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-4">
            Energy Intensity Benchmark — Australia vs Global Best (2024)
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={benchmarkData} margin={{ left: 4, right: 20, top: 4, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
              <Bar dataKey="australia_value" name="Australia" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="global_best_value" name="Global Best" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5 — Quarterly EET Score Trend */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 xl:col-span-2">
          <h2 className="text-base font-semibold text-white mb-4">
            Quarterly EET Score Trend 2022–2024 (3 Facilities)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendChartData} margin={{ left: 4, right: 20, top: 4, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
              {trendFacilityIds.map((fid, idx) => (
                <Line
                  key={fid}
                  type="monotone"
                  dataKey={fid}
                  name={facilityShortName[fid]}
                  stroke={TREND_LINE_COLORS[idx % TREND_LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Footer note */}
      <p className="mt-6 text-xs text-gray-600 text-center">
        Synthetic data — Australian industrial energy efficiency programs (EEIS, NABERS, EnMS, ISO 50001, Safeguard Mechanism).
        Best performing sector: <span className="text-indigo-400 font-medium">{summary.best_performing_sector}</span>
      </p>
    </div>
  )
}
