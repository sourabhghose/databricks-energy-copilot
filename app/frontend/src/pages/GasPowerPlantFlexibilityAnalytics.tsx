import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Flame } from 'lucide-react'
import {
  getGasPowerPlantFlexibilityDashboard,
  GPFADashboard,
} from '../api/client'

// ── Colour palettes ──────────────────────────────────────────────────────────
const TECH_COLOURS: Record<string, string> = {
  'CCGT':                '#3b82f6',
  'OCGT':                '#f59e0b',
  'SCGT':                '#10b981',
  'Reciprocating Engine':'#ef4444',
  'Cogeneration':        '#8b5cf6',
}

const SERVICE_COLOURS: Record<string, string> = {
  'FCAS Raise':      '#3b82f6',
  'FCAS Lower':      '#10b981',
  'Reserve':         '#f59e0b',
  'System Restart':  '#8b5cf6',
  'Black Start':     '#ef4444',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'Business As Usual': '#3b82f6',
  'High Renewable':    '#10b981',
  'Zero Carbon':       '#f59e0b',
}

const PLANT_COLOURS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#a3e635', '#ec4899', '#14b8a6',
]

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs text-gray-400 truncate">{label}</span>
      <span className="text-2xl font-bold text-white leading-none">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500 mt-0.5">{sub}</span>}
    </div>
  )
}

// ── Chart Section Wrapper ─────────────────────────────────────────────────────
function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GasPowerPlantFlexibilityAnalytics() {
  const [data, setData] = useState<GPFADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGasPowerPlantFlexibilityDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Gas Power Plant Flexibility Analytics...
      </div>
    )

  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )

  const { plants, dispatch, flexibility_services, maintenance_costs, future_plans, summary } = data

  // ── Chart 1: Ramp Rate by Plant (coloured by technology) ─────────────────
  const rampData = plants
    .slice()
    .sort((a, b) => b.ramp_rate_mw_min - a.ramp_rate_mw_min)
    .map(p => ({
      name: p.plant_name.replace(' Power Station', '').replace(' Cogeneration', ' Cogen'),
      ramp_rate: p.ramp_rate_mw_min,
      technology: p.technology,
    }))

  // ── Chart 2: Capacity Factor by Quarter for Top 5 Plants (2024) ──────────
  const dispatch2024 = dispatch.filter(d => d.year === 2024)
  // Rank plants by avg capacity factor in 2024
  const plantCfMap: Record<string, number[]> = {}
  dispatch2024.forEach(d => {
    if (!plantCfMap[d.plant_id]) plantCfMap[d.plant_id] = []
    plantCfMap[d.plant_id].push(d.capacity_factor_pct)
  })
  const plantAvgCf = Object.entries(plantCfMap).map(([id, cfs]) => ({
    id,
    avg: cfs.reduce((a, b) => a + b, 0) / cfs.length,
  }))
  plantAvgCf.sort((a, b) => b.avg - a.avg)
  const top5PlantIds = plantAvgCf.slice(0, 5).map(p => p.id)
  const top5PlantNames: Record<string, string> = {}
  plants.forEach(p => { top5PlantNames[p.plant_id] = p.plant_name.replace(' Power Station', '').replace(' Cogeneration', ' Cogen') })

  const cfByQuarter = [1, 2, 3, 4].map(q => {
    const row: Record<string, number | string> = { quarter: `Q${q}` }
    top5PlantIds.forEach(pid => {
      const d = dispatch2024.find(x => x.plant_id === pid && x.quarter === q)
      row[top5PlantNames[pid]] = d ? d.capacity_factor_pct : 0
    })
    return row
  })

  // ── Chart 3: FCAS Revenue Stacked Bar by Plant (2024, top 6 plants) ──────
  const fcas2024 = flexibility_services.filter(fs => fs.year === 2024 && fs.service_type.includes('FCAS'))
  const plantFcasTotal: Record<string, number> = {}
  fcas2024.forEach(fs => {
    plantFcasTotal[fs.plant_id] = (plantFcasTotal[fs.plant_id] ?? 0) + fs.revenue_m
  })
  const sortedFcasPlants = Object.entries(plantFcasTotal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id)

  const fcasServiceTypes = ['FCAS Raise', 'FCAS Lower']
  const fcasStackedData = sortedFcasPlants.map(pid => {
    const row: Record<string, number | string> = {
      plant: top5PlantNames[pid] ?? pid,
    }
    fcasServiceTypes.forEach(st => {
      const fs = fcas2024.find(x => x.plant_id === pid && x.service_type === st)
      row[st] = fs ? fs.revenue_m : 0
    })
    return row
  })

  // ── Chart 4: Total Maintenance Cost by Plant (2024) ───────────────────────
  const maint2024 = maintenance_costs.filter(m => m.year === 2024)
  const maintData = plants.map(p => {
    const m = maint2024.find(x => x.plant_id === p.plant_id)
    return {
      name: p.plant_name.replace(' Power Station', '').replace(' Cogeneration', ' Cogen'),
      total_maintenance_m: m ? m.total_maintenance_m : 0,
      plant_id: p.plant_id,
    }
  }).sort((a, b) => b.total_maintenance_m - a.total_maintenance_m)

  // ── Chart 5: Future CF by Year per Scenario (averaged across plants) ──────
  const scenarios = ['Business As Usual', 'High Renewable', 'Zero Carbon']
  const futureYears = [2025, 2030, 2035]
  const scenarioCfData = futureYears.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    scenarios.forEach(sc => {
      const plans = future_plans.filter(fp => fp.scenario === sc && fp.year === yr)
      const avg = plans.length > 0 ? plans.reduce((s, fp) => s + fp.capacity_factor_pct, 0) / plans.length : 0
      row[sc] = Math.round(avg * 10) / 10
    })
    return row
  })

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-white">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Flame className="text-orange-400" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Gas Power Plant Flexibility Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            CCGT / OCGT flexibility, FCAS services, maintenance economics and future scenarios
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Gas Capacity"
          value={summary.total_gas_capacity_mw.toLocaleString()}
          unit="MW"
          sub={`${plants.length} plants`}
        />
        <KpiCard
          label="Avg Ramp Rate"
          value={summary.avg_ramp_rate_mw_min.toFixed(1)}
          unit="MW/min"
          sub="fleet average"
        />
        <KpiCard
          label="Total FCAS Revenue"
          value={`$${summary.total_fcas_revenue_m.toFixed(1)}M`}
          sub="2024"
        />
        <KpiCard
          label="Avg Capacity Factor"
          value={`${summary.avg_capacity_factor_pct.toFixed(1)}%`}
          sub="2024 fleet average"
        />
        <KpiCard
          label="Fastest Hot Start"
          value={summary.fastest_start_plant.replace(' Power Station', '')}
          sub="lowest hot-start time"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Ramp Rate by Plant */}
        <ChartSection title="Ramp Rate by Plant (MW/min) — coloured by technology">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rampData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="ramp_rate" name="Ramp Rate (MW/min)" radius={[4, 4, 0, 0]}>
                {rampData.map((entry, idx) => (
                  <Cell key={idx} fill={TECH_COLOURS[entry.technology] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(TECH_COLOURS).map(([tech, colour]) => (
              <span key={tech} className="flex items-center gap-1 text-xs text-gray-400">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
                {tech}
              </span>
            ))}
          </div>
        </ChartSection>

        {/* Chart 2: Capacity Factor by Quarter for top 5 plants */}
        <ChartSection title="Capacity Factor by Quarter — Top 5 Plants (2024)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cfByQuarter} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {top5PlantIds.map((pid, idx) => (
                <Line
                  key={pid}
                  type="monotone"
                  dataKey={top5PlantNames[pid]}
                  stroke={PLANT_COLOURS[idx % PLANT_COLOURS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: FCAS Revenue stacked bar */}
        <ChartSection title="FCAS Revenue by Service Type — Top 6 Plants (2024, $M)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fcasStackedData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="plant"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              {fcasServiceTypes.map(st => (
                <Bar key={st} dataKey={st} stackId="fcas" fill={SERVICE_COLOURS[st]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* Chart 4: Maintenance Cost by Plant */}
        <ChartSection title="Total Maintenance Cost by Plant (2024, $M)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={maintData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Bar dataKey="total_maintenance_m" name="Maintenance ($M)" radius={[4, 4, 0, 0]}>
                {maintData.map((_, idx) => (
                  <Cell key={idx} fill={PLANT_COLOURS[idx % PLANT_COLOURS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* Chart 5: Future Capacity Factor Scenarios */}
      <ChartSection title="Projected Capacity Factor by Scenario (averaged across plants)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={scenarioCfData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {scenarios.map(sc => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLOURS[sc]}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Summary detail grid */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Plant Fleet Summary</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
          {plants.map(p => (
            <div key={p.plant_id} className="space-y-0.5">
              <dt className="text-xs font-medium text-gray-300 truncate">{p.plant_name}</dt>
              <dd className="text-xs text-gray-400">
                {p.technology} &middot; {p.region}
              </dd>
              <dd className="text-xs text-gray-400">
                {p.capacity_mw} MW &middot; {p.ramp_rate_mw_min} MW/min
              </dd>
              <dd className="text-xs text-gray-500">
                Hot start: {p.start_time_hot_min} min &middot; HR: {p.heat_rate_gj_mwh} GJ/MWh
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
