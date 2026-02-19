import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Network, Zap, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react'
import { api, NetworkDashboard, LossFactorRecord, NetworkConstraintLimit } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REGIONS = ['All', 'NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

function fmtMlf(v: number): string {
  return v.toFixed(4)
}

function fmtMw(v: number): string {
  return `${v.toLocaleString()} MW`
}

function fmtMva(v: number): string {
  return `${v.toLocaleString()} MVA`
}

function mlfColor(mlf: number): string {
  if (mlf > 1.02) return 'text-green-600 dark:text-green-400'
  if (mlf < 0.98) return 'text-red-600 dark:text-red-400'
  return 'text-blue-600 dark:text-blue-400'
}

function categoryBadge(cat: string): React.ReactElement {
  const styles: Record<string, string> = {
    high:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    low:    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[cat] ?? styles['normal']}`}>
      {cat.toUpperCase()}
    </span>
  )
}

function loadingStatusBadge(status: string): React.ReactElement {
  const styles: Record<string, string> = {
    normal:     'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    loaded:     'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    overloaded: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[status] ?? styles['normal']}`}>
      {status.toUpperCase()}
    </span>
  )
}

function LoadingBar({ pct }: { pct: number }): React.ReactElement {
  let barColor = 'bg-green-500'
  if (pct >= 80) barColor = 'bg-red-500'
  else if (pct >= 60) barColor = 'bg-amber-500'

  const widthPct = Math.min(pct, 100)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${barColor}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-right">
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MLF Distribution chart data builder
// ---------------------------------------------------------------------------

const MLF_BINS = [
  { label: '< 0.85',      min: 0,    max: 0.85  },
  { label: '0.85-0.90',   min: 0.85, max: 0.90  },
  { label: '0.90-0.95',   min: 0.90, max: 0.95  },
  { label: '0.95-0.98',   min: 0.95, max: 0.98  },
  { label: '0.98-1.02',   min: 0.98, max: 1.02  },
  { label: '1.02-1.05',   min: 1.02, max: 1.05  },
  { label: '> 1.05',      min: 1.05, max: Infinity },
]

function buildDistributionData(records: LossFactorRecord[]) {
  return MLF_BINS.map(bin => ({
    label: bin.label,
    count: records.filter(r => r.mlf >= bin.min && r.mlf < bin.max).length,
    color: bin.min >= 1.02 ? '#22c55e' : bin.max <= 0.98 ? '#ef4444' : '#3b82f6',
  }))
}

// ---------------------------------------------------------------------------
// Sort helpers for the loss factors table
// ---------------------------------------------------------------------------

type SortKey = keyof LossFactorRecord
type SortDir = 'asc' | 'desc'

function sortRecords(
  records: LossFactorRecord[],
  key: SortKey,
  dir: SortDir
): LossFactorRecord[] {
  return [...records].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (typeof av === 'number' && typeof bv === 'number') {
      return dir === 'asc' ? av - bv : bv - av
    }
    return dir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NetworkAnalytics(): React.ReactElement {
  const [data, setData] = useState<NetworkDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [region, setRegion] = useState('All')
  const [sortKey, setSortKey] = useState<SortKey>('mlf')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const regionParam = region === 'All' ? undefined : region
      const result = await api.getNetworkDashboard(regionParam)
      setData(result)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load network data')
    } finally {
      setLoading(false)
    }
  }, [region])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function SortArrow({ col }: { col: SortKey }): React.ReactElement | null {
    if (col !== sortKey) return null
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const sortedLossFactors = data
    ? sortRecords(data.loss_factors, sortKey, sortDir)
    : []

  const distributionData = data ? buildDistributionData(data.loss_factors) : []

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Network className="text-blue-500" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Transmission &amp; Loss Factors
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AEMO Marginal Loss Factors (MLF) &amp; network thermal loading
            </p>
          </div>
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-semibold rounded">
            MLF 2025-26
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Region selector */}
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          >
            {REGIONS.map(r => (
              <option key={r} value={r}>{r === 'All' ? 'All Regions' : r}</option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last refresh timestamp */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Last updated: {lastRefresh.toLocaleTimeString('en-AU')}
        &nbsp;&mdash;&nbsp;MLFs are set annually by AEMO for each financial year.
      </p>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 animate-pulse h-24" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Avg Renewable MLF */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Avg Renewable MLF
                </span>
              </div>
              <div className={`text-2xl font-bold ${mlfColor(data.avg_mlf_renewables)}`}>
                {fmtMlf(data.avg_mlf_renewables)}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {data.avg_mlf_renewables < 0.98
                  ? 'Below parity — revenue penalty'
                  : data.avg_mlf_renewables > 1.02
                  ? 'Above parity — revenue gain'
                  : 'Near parity'}
              </div>
            </div>

            {/* Avg Thermal MLF */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-amber-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Avg Thermal MLF
                </span>
              </div>
              <div className={`text-2xl font-bold ${mlfColor(data.avg_mlf_thermal)}`}>
                {fmtMlf(data.avg_mlf_thermal)}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Near load centres
              </div>
            </div>

            {/* Low MLF generators */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Low MLF Generators
                </span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {data.low_mlf_generators}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mb-1">units &lt; 0.95</span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Significant revenue impact
              </div>
            </div>

            {/* High MLF generators */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-green-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  High MLF Generators
                </span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {data.high_mlf_generators}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mb-1">units &gt; 1.02</span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Near-load revenue premium
              </div>
            </div>
          </div>

          {/* MLF Distribution chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
              MLF Distribution — {region === 'All' ? 'All Regions' : region} ({data.total_connection_points} connection points)
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distributionData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#9ca3af' } }}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Generators']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" name="Generators" radius={[3, 3, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Green = high MLF (&gt; 1.02, profitable zone) &nbsp;|&nbsp;
              Blue = normal (0.98-1.02) &nbsp;|&nbsp;
              Red = low MLF (&lt; 0.98, revenue penalty)
            </p>
          </div>

          {/* Loss Factors table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Loss Factor Records
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Sorted by MLF ascending by default (worst revenue impact first). Click column headers to sort.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-750">
                  <tr>
                    {(
                      [
                        ['station_name', 'Station'],
                        ['duid',         'DUID'],
                        ['region',       'Region'],
                        ['fuel_type',    'Fuel'],
                        ['registered_capacity_mw', 'Capacity MW'],
                        ['mlf',          'MLF'],
                        ['dlf',          'DLF'],
                        ['combined_lf',  'Combined LF'],
                        ['mlf_category', 'Category'],
                        ['mlf_prior_year','Prior Year'],
                        ['mlf_change',   'YoY Change'],
                      ] as [SortKey, string][]
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none whitespace-nowrap"
                      >
                        {label}
                        <SortArrow col={key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sortedLossFactors.map(lf => (
                    <tr
                      key={lf.duid}
                      className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {lf.station_name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                        {lf.duid}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {lf.region}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {lf.fuel_type}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">
                        {lf.registered_capacity_mw.toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 font-semibold text-right whitespace-nowrap ${mlfColor(lf.mlf)}`}>
                        {fmtMlf(lf.mlf)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">
                        {fmtMlf(lf.dlf)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">
                        {fmtMlf(lf.combined_lf)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {categoryBadge(lf.mlf_category)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">
                        {fmtMlf(lf.mlf_prior_year)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {lf.mlf_change >= 0 ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold">
                            ↑ +{fmtMlf(lf.mlf_change)}
                          </span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            ↓ {fmtMlf(lf.mlf_change)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Network Elements loading table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Transmission Element Loading
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Thermal limits and N-1 contingency ratings. Red = overloaded (&ge; 80%), amber = loaded (&ge; 60%).
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-750">
                  <tr>
                    {[
                      'Element',
                      'Region',
                      'Voltage kV',
                      'Thermal Limit MVA',
                      'Current Flow MVA',
                      'Loading %',
                      'N-1 Limit MVA',
                      'Status',
                    ].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.network_elements.map((el: NetworkConstraintLimit) => (
                    <tr
                      key={el.element_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {el.element_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {el.region}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">
                        {el.voltage_kv}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">
                        {fmtMva(el.thermal_limit_mva)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">
                        {fmtMva(el.current_flow_mva)}
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <LoadingBar pct={el.loading_pct} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">
                        {fmtMva(el.n1_contingency_mva)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {loadingStatusBadge(el.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
