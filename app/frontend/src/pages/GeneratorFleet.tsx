import React, { useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { Zap, Leaf, Wind, Activity, RefreshCw } from 'lucide-react'
import { api, GeneratorRecord, GenerationSummary } from '../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const
type Region = typeof REGIONS[number]

const FUEL_COLORS: Record<string, string> = {
  Coal:    '#374151',
  Gas:     '#6B7280',
  Wind:    '#3B82F6',
  Solar:   '#F59E0B',
  Hydro:   '#06B6D4',
  Battery: '#8B5CF6',
  Biomass: '#10B981',
}

const FUEL_BADGE_CLASSES: Record<string, string> = {
  Coal:    'bg-gray-700 text-gray-100',
  Gas:     'bg-gray-500 text-gray-100',
  Wind:    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Solar:   'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  Hydro:   'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  Battery: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  Biomass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  colorClass?: string
}

function SummaryCard({ icon, label, value, sub, colorClass = 'text-gray-900 dark:text-gray-100' }: SummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-gray-400 dark:text-gray-500">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${colorClass}`}>{value}</p>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

interface FuelBadgeProps {
  fuelType: string
}

function FuelBadge({ fuelType }: FuelBadgeProps) {
  const cls = FUEL_BADGE_CLASSES[fuelType] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {fuelType}
    </span>
  )
}

type SortField = 'station_name' | 'fuel_type' | 'region' | 'registered_capacity_mw' | 'current_output_mw' | 'availability_mw' | 'capacity_factor'
type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Custom pie chart label
// ---------------------------------------------------------------------------

interface PieLabelProps {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  name: string
  value: number
}

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, value }: PieLabelProps) {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 1.35
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  if (value < 100) return null // skip tiny slices to avoid label clutter
  return (
    <text
      x={x}
      y={y}
      fill="#6B7280"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
    >
      {name} {value.toFixed(0)} MW
    </text>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function GeneratorFleet() {
  const [region, setRegion] = useState<Region>('NSW1')
  const [mix, setMix] = useState<GenerationSummary | null>(null)
  const [units, setUnits] = useState<GeneratorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('current_output_mw')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mixData, unitsData] = await Promise.all([
        api.getGenerationMix(region),
        api.getGenerationUnits(region),
      ])
      setMix(mixData)
      setUnits(unitsData)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load generator fleet data')
    } finally {
      setLoading(false)
    }
  }, [region])

  // Initial fetch and region change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  // ---------------------------------------------------------------------------
  // Sorting logic
  // ---------------------------------------------------------------------------

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedUnits = [...units].sort((a, b) => {
    const av = a[sortField] as string | number
    const bv = b[sortField] as string | number
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  // ---------------------------------------------------------------------------
  // Status badge helper
  // ---------------------------------------------------------------------------

  function statusBadge(cf: number) {
    if (cf > 0.8)
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">High</span>
    if (cf > 0.2)
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Running</span>
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Low</span>
  }

  // ---------------------------------------------------------------------------
  // Renewable vs fossil bar helpers
  // ---------------------------------------------------------------------------

  const renewablePct = mix?.renewable_percentage ?? 0
  const fossilPct = 100 - renewablePct

  function renewableColorClass(pct: number) {
    if (pct >= 50) return 'text-green-600 dark:text-green-400'
    if (pct >= 30) return 'text-amber-500 dark:text-amber-400'
    return 'text-red-500 dark:text-red-400'
  }

  // Pie chart data
  const pieData = (mix?.fuel_mix ?? []).map(fm => ({
    name: fm.fuel_type,
    value: fm.total_mw,
  }))

  // Sort column header helper
  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-gray-400">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
        )}
      </span>
    </th>
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="text-amber-400" size={24} />
            Generator Fleet
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            NEM generation mix, fuel type breakdown and renewable penetration
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Region selector */}
          <select
            value={region}
            onChange={e => setRegion(e.target.value as Region)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Last updated */}
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString('en-AU')}
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
          {error} — showing indicative data
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Summary cards                                                        */}
      {/* ------------------------------------------------------------------ */}
      {loading && !mix ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      ) : mix && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Zap size={20} />}
            label="Total Generation"
            value={`${mix.total_generation_mw.toFixed(0)} MW`}
            sub={`Region: ${region}`}
          />
          <SummaryCard
            icon={<Leaf size={20} />}
            label="Renewable Share"
            value={`${mix.renewable_percentage.toFixed(1)}%`}
            sub={`${mix.renewable_mw.toFixed(0)} MW renewable`}
            colorClass={renewableColorClass(mix.renewable_percentage)}
          />
          <SummaryCard
            icon={<Wind size={20} />}
            label="Carbon Intensity"
            value={`${mix.carbon_intensity_kg_co2_mwh.toFixed(0)} kg CO\u2082/MWh`}
            sub="Weighted average"
          />
          <SummaryCard
            icon={<Activity size={20} />}
            label="Online Units"
            value={String(units.filter(u => u.current_output_mw > 0).length)}
            sub={`of ${units.length} total units`}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Charts row: Pie chart + Renewable/Fossil bar                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Fuel Mix Donut Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Fuel Mix</h2>
          {loading && !mix ? (
            <div className="h-64 bg-gray-100 dark:bg-gray-700 animate-pulse rounded" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={(props) => <PieLabel {...props} />}
                    labelLine={false}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={FUEL_COLORS[entry.name] ?? '#9CA3AF'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`${val.toFixed(0)} MW`, 'Output']}
                    contentStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 justify-center">
                {(mix?.fuel_mix ?? []).map(fm => (
                  <div key={fm.fuel_type} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                    <span
                      className="w-3 h-3 rounded-sm inline-block shrink-0"
                      style={{ backgroundColor: FUEL_COLORS[fm.fuel_type] ?? '#9CA3AF' }}
                    />
                    {fm.fuel_type} ({fm.percentage.toFixed(1)}%)
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Renewable vs Fossil bar + mix table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Renewables vs Fossil</h2>

          {loading && !mix ? (
            <div className="h-12 bg-gray-100 dark:bg-gray-700 animate-pulse rounded" />
          ) : (
            <>
              {/* Stacked progress bar */}
              <div>
                <div className="flex rounded-full overflow-hidden h-6 w-full">
                  <div
                    className="bg-green-500 transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${renewablePct}%` }}
                  >
                    {renewablePct >= 15 && (
                      <span className="text-xs font-bold text-white">
                        Renewables {renewablePct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div
                    className="bg-gray-400 dark:bg-gray-500 transition-all duration-500 flex items-center justify-center"
                    style={{ width: `${fossilPct}%` }}
                  >
                    {fossilPct >= 15 && (
                      <span className="text-xs font-bold text-white">
                        Fossil {fossilPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span className="text-green-600 dark:text-green-400 font-medium">Renewables {renewablePct.toFixed(1)}%</span>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Fossil {fossilPct.toFixed(1)}%</span>
                </div>
              </div>

              {/* Fuel type breakdown table */}
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left py-1.5 text-gray-500 dark:text-gray-400 font-medium">Fuel</th>
                      <th className="text-right py-1.5 text-gray-500 dark:text-gray-400 font-medium">Output (MW)</th>
                      <th className="text-right py-1.5 text-gray-500 dark:text-gray-400 font-medium">Share</th>
                      <th className="text-right py-1.5 text-gray-500 dark:text-gray-400 font-medium">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(mix?.fuel_mix ?? []).map(fm => (
                      <tr
                        key={fm.fuel_type}
                        className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <td className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                              style={{ backgroundColor: FUEL_COLORS[fm.fuel_type] ?? '#9CA3AF' }}
                            />
                            <span className="text-gray-700 dark:text-gray-200">{fm.fuel_type}</span>
                            {fm.is_renewable && (
                              <span className="text-green-500 text-xs" title="Renewable">&#x2665;</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 text-right text-gray-700 dark:text-gray-200 font-mono">
                          {fm.total_mw.toFixed(0)}
                        </td>
                        <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">
                          {fm.percentage.toFixed(1)}%
                        </td>
                        <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">
                          {fm.unit_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Generator units table                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Generator Units
            <span className="ml-2 text-xs text-gray-400 font-normal">
              {units.length} units — click column headers to sort
            </span>
          </h2>
        </div>

        {loading && units.length === 0 ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <SortHeader field="station_name">Station Name</SortHeader>
                  <SortHeader field="fuel_type">Fuel Type</SortHeader>
                  <SortHeader field="region">Region</SortHeader>
                  <SortHeader field="registered_capacity_mw">Capacity (MW)</SortHeader>
                  <SortHeader field="current_output_mw">Output (MW)</SortHeader>
                  <SortHeader field="availability_mw">Avail (MW)</SortHeader>
                  <SortHeader field="capacity_factor">Cap. Factor</SortHeader>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedUnits.map(unit => (
                  <tr
                    key={unit.duid}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100 font-medium">
                      {unit.station_name}
                      <span className="ml-1.5 text-xs text-gray-400 font-mono">{unit.duid}</span>
                    </td>
                    <td className="px-3 py-2">
                      <FuelBadge fuelType={unit.fuel_type} />
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {unit.region}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200 font-mono">
                      {unit.registered_capacity_mw.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-gray-800 dark:text-gray-100">
                      {unit.current_output_mw.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-mono">
                      {unit.availability_mw.toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${(unit.capacity_factor * 100).toFixed(0)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          {(unit.capacity_factor * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {statusBadge(unit.capacity_factor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
