import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { AlertTriangle, Zap, RefreshCw } from 'lucide-react'
import { api, ConstraintRecord, FcasRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const REGIONS = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const
type Region = typeof REGIONS[number]

const CONSTRAINT_HOURS = [4, 24, 48, 168] as const
const FCAS_HOURS = [1, 4, 24] as const

// Colour helpers for FCAS services
const FCAS_COLORS: Record<string, string> = {
  RAISE6SEC:  '#1d4ed8',
  RAISE60SEC: '#2563eb',
  RAISE5MIN:  '#3b82f6',
  RAISEREG:   '#93c5fd',
  LOWER6SEC:  '#c2410c',
  LOWER60SEC: '#ea580c',
  LOWER5MIN:  '#f97316',
  LOWERREG:   '#fdba74',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RegionSelector({
  value,
  onChange,
}: {
  value: Region
  onChange: (r: Region) => void
}) {
  return (
    <div className="flex gap-1">
      {REGIONS.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={[
            'px-3 py-1.5 rounded text-xs font-semibold transition-colors',
            value === r
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
          ].join(' ')}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Binding Constraints tab
// ---------------------------------------------------------------------------

function ConstraintsTab() {
  const [region, setRegion] = useState<Region>('NSW1')
  const [hoursBack, setHoursBack] = useState<number>(24)
  const [bindingOnly, setBindingOnly] = useState(false)
  const [data, setData] = useState<ConstraintRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .getConstraints(region, hoursBack, bindingOnly)
      .then(rows => setData(rows))
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [region, hoursBack, bindingOnly])

  // Horizontal bar chart: constraintid on Y axis, marginalvalue on X axis
  const chartData = [...data]
    .sort((a, b) => b.marginalvalue - a.marginalvalue)
    .slice(0, 10)
    .map(r => ({ name: r.constraintid, value: r.marginalvalue }))

  function rowColor(row: ConstraintRecord) {
    if (row.violationdegree > 0) return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
    if (row.marginalvalue > 0) return 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400'
    return ''
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <RegionSelector value={region} onChange={setRegion} />

        <div className="flex gap-1">
          {CONSTRAINT_HOURS.map(h => (
            <button
              key={h}
              onClick={() => setHoursBack(h)}
              className={[
                'px-3 py-1.5 rounded text-xs font-semibold transition-colors',
                hoursBack === h
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
              ].join(' ')}
            >
              {h === 168 ? '7d' : `${h}h`}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={bindingOnly}
            onChange={e => setBindingOnly(e.target.checked)}
            className="accent-blue-600 w-4 h-4"
          />
          Binding only
        </label>

        {loading && (
          <RefreshCw size={16} className="animate-spin text-blue-500" />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
          Binding (marginal value &gt; 0)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
          Violated
        </span>
      </div>

      {/* Horizontal bar chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Top Binding Constraints — Marginal Value ($/MW)
          </h3>
          <ResponsiveContainer width="100%" height={chartData.length * 40 + 20}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 160, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={155}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v: number) => [`$${v.toFixed(2)}/MW`, 'Marginal Value']}
              />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                Constraint ID
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                RHS (MW)
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                Marginal Value ($/MW)
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                Violation Degree
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                  No constraint data available.
                </td>
              </tr>
            )}
            {data.map((row, i) => (
              <tr key={i} className={rowColor(row)}>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-200">
                  {row.constraintid}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                  {row.rhs.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                  ${row.marginalvalue.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                  {row.violationdegree > 0 ? (
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                      {row.violationdegree.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FCAS Markets tab
// ---------------------------------------------------------------------------

function FcasTab() {
  const [region, setRegion] = useState<Region>('NSW1')
  const [hoursBack, setHoursBack] = useState<number>(4)
  const [data, setData] = useState<FcasRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .getFcas(region, hoursBack)
      .then(rows => setData(rows))
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [region, hoursBack])

  // Aggregate by service (latest record per service for display)
  const byService = Object.fromEntries(
    data.reduce((acc, r) => {
      if (!acc.has(r.service)) acc.set(r.service, r)
      return acc
    }, new Map<string, FcasRecord>()).entries()
  )
  const serviceOrder = [
    'RAISE6SEC', 'RAISE60SEC', 'RAISE5MIN', 'RAISEREG',
    'LOWER6SEC', 'LOWER60SEC', 'LOWER5MIN', 'LOWERREG',
  ]
  const priceChartData = serviceOrder
    .filter(s => byService[s])
    .map(s => ({ service: s, rrp: byService[s].rrp }))

  const mwChartData = serviceOrder
    .filter(s => byService[s])
    .map(s => ({ service: s, clearedmw: byService[s].clearedmw }))

  // Summary stats
  const allRecords = serviceOrder.filter(s => byService[s]).map(s => byService[s])
  const totalCost = allRecords.reduce((sum, r) => sum + r.rrp * r.clearedmw, 0)
  const highestPriced = allRecords.reduce(
    (best, r) => (r.rrp > (best?.rrp ?? -Infinity) ? r : best),
    null as FcasRecord | null
  )
  const largestCleared = allRecords.reduce(
    (best, r) => (r.clearedmw > (best?.clearedmw ?? -Infinity) ? r : best),
    null as FcasRecord | null
  )

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <RegionSelector value={region} onChange={setRegion} />

        <div className="flex gap-1">
          {FCAS_HOURS.map(h => (
            <button
              key={h}
              onClick={() => setHoursBack(h)}
              className={[
                'px-3 py-1.5 rounded text-xs font-semibold transition-colors',
                hoursBack === h
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
              ].join(' ')}
            >
              {h}h
            </button>
          ))}
        </div>

        {loading && (
          <RefreshCw size={16} className="animate-spin text-blue-500" />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total FCAS Cost Estimate</div>
          <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
            ${(totalCost / 1000).toFixed(1)}k/hr
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <Zap size={12} className="text-amber-500" />
            Highest Priced Service
          </div>
          <div className="text-base font-bold text-amber-600 dark:text-amber-400">
            {highestPriced ? highestPriced.service : '—'}
          </div>
          {highestPriced && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ${highestPriced.rrp.toFixed(2)}/MW
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Largest Cleared Service</div>
          <div className="text-base font-bold text-blue-600 dark:text-blue-400">
            {largestCleared ? largestCleared.service : '—'}
          </div>
          {largestCleared && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {largestCleared.clearedmw.toFixed(1)} MW
            </div>
          )}
        </div>
      </div>

      {/* Two charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: FCAS prices by service */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            FCAS Price by Service ($/MW)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={priceChartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="service"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}/MW`, 'Price']} />
              <Bar dataKey="rrp" radius={[4, 4, 0, 0]}>
                {priceChartData.map((entry, idx) => (
                  <rect
                    key={`cell-${idx}`}
                    fill={FCAS_COLORS[entry.service] ?? '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Manual colour swatch legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {serviceOrder.map(s => (
              <span key={s} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ backgroundColor: FCAS_COLORS[s] ?? '#6b7280' }}
                />
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Cleared MW by service */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Cleared MW by Service
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={mwChartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="service"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)} MW`, 'Cleared']} />
              <Bar dataKey="clearedmw" radius={[4, 4, 0, 0]}>
                {mwChartData.map((entry, idx) => (
                  <rect
                    key={`cell-${idx}`}
                    fill={FCAS_COLORS[entry.service] ?? '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type Tab = 'constraints' | 'fcas'

export default function MarketDepth() {
  const [activeTab, setActiveTab] = useState<Tab>('constraints')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'constraints', label: 'Binding Constraints' },
    { id: 'fcas',        label: 'FCAS Markets' },
  ]

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Market Depth
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Network constraints and FCAS ancillary service markets
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'constraints' && <ConstraintsTab />}
      {activeTab === 'fcas' && <FcasTab />}
    </div>
  )
}
