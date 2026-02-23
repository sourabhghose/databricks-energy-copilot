import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getWholesaleGasMarketDashboard,
  WGMADashboard,
} from '../api/client'

const HUB_COLORS: Record<string, string> = {
  Wallumbilla:         '#f97316',
  Moomba:              '#6366f1',
  DWGM:                '#22c55e',
  'Short-Term Sydney': '#06b6d4',
  Brisbane:            '#f59e0b',
  Adelaide:            '#a855f7',
  'King Island':       '#ef4444',
}

const FIELD_TYPE_COLORS: Record<string, string> = {
  Conventional: '#6366f1',
  CSG:          '#22c55e',
  Tight:        '#f59e0b',
  Shale:        '#ef4444',
  Offshore:     '#06b6d4',
}

const SECTOR_COLORS: Record<string, string> = {
  'Power Generation': '#f97316',
  Industrial:         '#6366f1',
  Residential:        '#22c55e',
  Commercial:         '#f59e0b',
  'LNG Export':       '#ef4444',
  'Gas Injection':    '#06b6d4',
}

const SEASONAL_COLORS: Record<string, string> = {
  'Summer Injection':  '#22c55e',
  'Winter Withdrawal': '#6366f1',
  Balancing:           '#f59e0b',
}

const SCENARIO_COLORS: Record<string, string> = {
  'High LNG Export':   '#ef4444',
  'Domestic Priority': '#22c55e',
  Electrification:     '#6366f1',
}

export default function WholesaleGasMarketAnalytics() {
  const [data, setData] = useState<WGMADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWholesaleGasMarketDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-500">
        Error loading Wholesale Gas Market Analytics: {error ?? 'No data'}
      </div>
    )
  }

  const { prices, supply, demand, pipelines, storage, scenarios, summary } = data

  // --- Chart 1: Gas Hub Price Trend (Wallumbilla, Moomba, DWGM) ---
  const hubsToShow = ['Wallumbilla', 'Moomba', 'DWGM']
  const priceByMonthHub: Record<string, Record<string, number>> = {}
  prices.forEach(p => {
    if (!hubsToShow.includes(p.hub)) return
    if (!priceByMonthHub[p.date_month]) priceByMonthHub[p.date_month] = {}
    priceByMonthHub[p.date_month][p.hub] = p.price_gj
  })
  const hubTrendData = Object.entries(priceByMonthHub)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({ month: month.slice(2), ...vals }))

  // --- Chart 2: Supply Basin Overview (production by basin x field_type) ---
  const basinFieldMap: Record<string, Record<string, number>> = {}
  supply.forEach(s => {
    if (s.production_pj_year <= 0) return
    if (!basinFieldMap[s.basin]) basinFieldMap[s.basin] = {}
    basinFieldMap[s.basin][s.field_type] = (basinFieldMap[s.basin][s.field_type] ?? 0) + s.production_pj_year
  })
  const basinSupplyData = Object.entries(basinFieldMap).map(([basin, fields]) => ({
    basin: basin.replace(' Basin', '').replace('Surat-Bowen', 'Surat/Bowen'),
    ...fields,
  }))
  const uniqueFieldTypes = Array.from(new Set(supply.map(s => s.field_type)))

  // --- Chart 3: Demand by Sector (stacked bar, quarterly) ---
  const quarterSectorMap: Record<string, Record<string, number>> = {}
  demand.forEach(d => {
    if (!quarterSectorMap[d.quarter]) quarterSectorMap[d.quarter] = {}
    quarterSectorMap[d.quarter][d.sector] = (quarterSectorMap[d.quarter][d.sector] ?? 0) + d.demand_pj
  })
  const demandChartData = Object.entries(quarterSectorMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([q, secs]) => ({ quarter: q.replace('-', '\n'), ...secs }))
  const uniqueSectors = Array.from(new Set(demand.map(d => d.sector)))

  // --- Chart 4: Pipeline Utilisation (horizontal bar, sorted) ---
  const pipelineUtilData = [...pipelines]
    .sort((a, b) => b.utilisation_pct - a.utilisation_pct)
    .map(p => ({
      name: p.pipeline_name.replace(' Pipeline', '').replace(' Natural Gas', ''),
      utilisation: p.utilisation_pct,
    }))

  // --- Chart 5: Storage Inventory by name ---
  const storageInventoryData = storage.map(s => ({
    name: s.storage_name.replace(' Gas Storage', '').replace(' Gas Plant', '').replace(' Underground Storage', ''),
    inventory: s.inventory_pct,
    seasonal_role: s.seasonal_role,
  }))

  // --- Chart 6: Scenario Domestic vs Export (AreaChart 2024-2035) ---
  // Aggregate per year per scenario (use first scenario found for each year if multiple)
  const scenarioYearMap: Record<string, { domestic: number; lng: number; scenario: string }> = {}
  scenarios.forEach(s => {
    const key = `${s.year}-${s.scenario}`
    if (!scenarioYearMap[key]) {
      scenarioYearMap[key] = { domestic: s.domestic_demand_pj, lng: s.lng_export_pj, scenario: s.scenario }
    }
  })
  // Build data for default scenario (Domestic Priority) across years
  const scenarioNames = ['High LNG Export', 'Domestic Priority', 'Electrification']
  const scenarioChartMap: Record<number, Record<string, { domestic: number; lng: number }>> = {}
  scenarios.forEach(s => {
    if (!scenarioChartMap[s.year]) scenarioChartMap[s.year] = {}
    if (!scenarioChartMap[s.year][s.scenario]) {
      scenarioChartMap[s.year][s.scenario] = { domestic: s.domestic_demand_pj, lng: s.lng_export_pj }
    }
  })
  const scenarioAreaData = Object.entries(scenarioChartMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([yr, scens]) => {
      const row: Record<string, number | string> = { year: Number(yr) }
      scenarioNames.forEach(sc => {
        if (scens[sc]) {
          row[`${sc}_domestic`] = scens[sc].domestic
          row[`${sc}_lng`] = scens[sc].lng
        }
      })
      return row
    })

  const kpiClass = "bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Flame className="text-orange-500" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Wholesale Gas Market Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            STTM, GSH, DWGM, LNG Netback, East Coast Supply/Demand &amp; Storage
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={kpiClass}>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Spot Price</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            ${summary.avg_spot_price_gj.toFixed(2)}
            <span className="text-sm font-normal text-gray-500 ml-1">/GJ</span>
          </p>
        </div>
        <div className={kpiClass}>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Production</p>
          <p className="text-2xl font-bold text-indigo-500 mt-1">
            {summary.total_east_coast_production_pj.toFixed(0)}
            <span className="text-sm font-normal text-gray-500 ml-1">PJ/yr</span>
          </p>
        </div>
        <div className={kpiClass}>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">LNG Export Share</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            {summary.lng_export_share_pct.toFixed(1)}
            <span className="text-sm font-normal text-gray-500 ml-1">%</span>
          </p>
        </div>
        <div className={kpiClass}>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Pipeline Util.</p>
          <p className="text-2xl font-bold text-green-500 mt-1">
            {summary.pipeline_avg_utilisation_pct.toFixed(1)}
            <span className="text-sm font-normal text-gray-500 ml-1">%</span>
          </p>
        </div>
      </div>

      {/* Chart Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Gas Hub Price Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Gas Hub Price Trend ($/GJ)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hubTrendData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[6, 22]} unit=" $" />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}/GJ`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {hubsToShow.map(hub => (
                <Line
                  key={hub}
                  type="monotone"
                  dataKey={hub}
                  stroke={HUB_COLORS[hub]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Supply Basin Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Supply Basin Overview (PJ/yr by Field Type)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={basinSupplyData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="basin" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} unit=" PJ" />
              <Tooltip formatter={(v: number) => [`${v.toFixed(0)} PJ/yr`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {uniqueFieldTypes.map(ft => (
                <Bar key={ft} dataKey={ft} stackId="a" fill={FIELD_TYPE_COLORS[ft] ?? '#94a3b8'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Demand by Sector */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Demand by Sector (PJ — Quarterly)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={demandChartData} margin={{ top: 4, right: 16, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="quarter" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} unit=" PJ" />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)} PJ`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {uniqueSectors.map(sec => (
                <Bar key={sec} dataKey={sec} stackId="d" fill={SECTOR_COLORS[sec] ?? '#94a3b8'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Pipeline Utilisation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Pipeline Utilisation (%)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={pipelineUtilData}
              margin={{ top: 4, right: 40, left: 160, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={155} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`]} />
              <Bar dataKey="utilisation" radius={[0, 3, 3, 0]}>
                {pipelineUtilData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.utilisation >= 90 ? '#ef4444' : entry.utilisation >= 75 ? '#f97316' : '#22c55e'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 5: Storage Inventory */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Storage Inventory (% Working Gas)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={storageInventoryData} margin={{ top: 4, right: 16, left: 0, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`]} />
              <Bar dataKey="inventory" radius={[3, 3, 0, 0]}>
                {storageInventoryData.map((entry, index) => (
                  <Cell key={`stor-${index}`} fill={SEASONAL_COLORS[entry.seasonal_role] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 flex-wrap text-xs">
            {Object.entries(SEASONAL_COLORS).map(([role, color]) => (
              <span key={role} className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 6: Scenario Domestic vs Export */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Scenario: Domestic Demand vs LNG Export (PJ, 2024–2035)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={scenarioAreaData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" PJ" />
              <Tooltip formatter={(v: number) => [`${v.toFixed(0)} PJ`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="Domestic Priority_domestic"
                name="Domestic Demand (Priority)"
                stackId="1"
                stroke="#22c55e"
                fill="#bbf7d0"
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="High LNG Export_lng"
                name="LNG Export (High)"
                stackId="2"
                stroke="#ef4444"
                fill="#fecaca"
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="Electrification_domestic"
                name="Domestic Demand (Electrification)"
                stackId="3"
                stroke="#6366f1"
                fill="#e0e7ff"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="bg-orange-50 dark:bg-gray-800 rounded-xl p-4 border border-orange-100 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Avg Storage Inventory</span>
            <span className="ml-2 font-semibold text-gray-800 dark:text-white">
              {summary.storage_avg_inventory_pct.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Projected 2030 Price</span>
            <span className="ml-2 font-semibold text-gray-800 dark:text-white">
              ${summary.projected_2030_price_gj.toFixed(2)}/GJ
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">LNG Export Share</span>
            <span className="ml-2 font-semibold text-gray-800 dark:text-white">
              {summary.lng_export_share_pct.toFixed(1)}% of production
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
