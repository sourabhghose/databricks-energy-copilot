import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { BarChart2, RefreshCw, Zap, TrendingUp, AlertCircle } from 'lucide-react'
import { api, BidStackSummary, GeneratorOfferRecord, RebidRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const FUEL_COLOURS: Record<string, string> = {
  Coal: '#6b7280',
  'Gas OCGT': '#f97316',
  'Gas CCGT': '#f59e0b',
  Hydro: '#3b82f6',
  Wind: '#10b981',
  Solar: '#eab308',
  Battery: '#8b5cf6',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  VIC1: '#8b5cf6',
  QLD1: '#f59e0b',
  SA1: '#ef4444',
  TAS1: '#10b981',
}

function fuelChip(fuelType: string) {
  const colour = FUEL_COLOURS[fuelType] ?? '#6b7280'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: colour }}
    >
      {fuelType}
    </span>
  )
}

function regionChip(region: string) {
  const colour = REGION_COLOURS[region] ?? '#6b7280'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: colour }}
    >
      {region}
    </span>
  )
}

function reasonCodeBadge(code: string) {
  const colours: Record<string, string> = {
    ECON: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    PLANT: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    PRICE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    PROTO: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  }
  const cls = colours[code] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {code}
    </span>
  )
}

function offerPriceColour(price: number): string {
  if (price < 0) return 'text-green-600 dark:text-green-400'
  if (price <= 50) return 'text-blue-600 dark:text-blue-400'
  if (price <= 200) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ title, value, subtitle, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fuel Type Breakdown BarChart
// ---------------------------------------------------------------------------

function FuelTypeChart({ breakdown }: { breakdown: Array<{ fuel_type: string; offered_mw: number; avg_price: number }> }) {
  const data = [...breakdown].sort((a, b) => b.offered_mw - a.offered_mw)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Offered MW by Fuel Type</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="fuel_type"
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickFormatter={(v: number) => `${v}`}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#6b7280' } }}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'offered_mw') return [`${value.toFixed(0)} MW`, 'Offered MW']
              return [value, name]
            }}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend formatter={(v) => v === 'offered_mw' ? 'Offered MW' : v} />
          <Bar dataKey="offered_mw" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.fuel_type} fill={FUEL_COLOURS[entry.fuel_type] ?? '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generator Offer Records table
// ---------------------------------------------------------------------------

function OfferRecordsTable({ records }: { records: GeneratorOfferRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Generator Offer Records</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">DUID</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Station</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fuel Type</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Region</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Max Cap (MW)</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Avg Offer $/MWh</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Rebids Today</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map((r) => (
              <tr key={r.duid} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">{r.duid}</td>
                <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium max-w-xs truncate" title={r.station_name}>{r.station_name}</td>
                <td className="px-4 py-2.5">{fuelChip(r.fuel_type)}</td>
                <td className="px-4 py-2.5">{regionChip(r.region)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">{r.max_capacity_mw.toFixed(0)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`font-semibold ${offerPriceColour(r.daily_energy_price_avg)}`}>
                    ${r.daily_energy_price_avg.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.rebit_count_today > 5 ? (
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      {r.rebit_count_today}
                    </span>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-300">{r.rebit_count_today}</span>
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
// Rebid Log table
// ---------------------------------------------------------------------------

function RebidLogTable({ rebids }: { rebids: RebidRecord[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Rebid Log</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Time</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">DUID</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Station</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fuel</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reason</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">MW Change</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Band</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Old → New Price</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reason Text</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rebids.map((r, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">{r.rebid_time}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">{r.duid}</td>
                <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium max-w-xs truncate" title={r.station_name}>{r.station_name}</td>
                <td className="px-4 py-2.5">{fuelChip(r.fuel_type)}</td>
                <td className="px-4 py-2.5">{reasonCodeBadge(r.reason_code)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`font-semibold ${r.mw_change > 0 ? 'text-green-600 dark:text-green-400' : r.mw_change < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {r.mw_change > 0 ? '+' : ''}{r.mw_change.toFixed(0)} MW
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">{r.price_band_changed}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 text-xs">
                  ${r.old_price.toLocaleString()} → ${r.new_price.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 max-w-xs truncate text-xs" title={r.reason_text}>{r.reason_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

const REGIONS = ['', 'NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
const FUEL_TYPES = ['', 'Coal', 'Gas OCGT', 'Gas CCGT', 'Hydro', 'Wind', 'Solar', 'Battery']

interface FilterBarProps {
  region: string
  fuelType: string
  onRegionChange: (r: string) => void
  onFuelTypeChange: (f: string) => void
}

function FilterBar({ region, fuelType, onRegionChange, onFuelTypeChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Region:</label>
        <select
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r || 'All Regions'}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Fuel Type:</label>
        <select
          value={fuelType}
          onChange={(e) => onFuelTypeChange(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {FUEL_TYPES.map((f) => (
            <option key={f} value={f}>{f || 'All Fuel Types'}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BiddingAnalytics() {
  const [summary, setSummary] = useState<BidStackSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [region, setRegion] = useState('')
  const [fuelType, setFuelType] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getBidStack(region || undefined, fuelType || undefined)
      setSummary(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bid stack data')
    } finally {
      setLoading(false)
    }
  }, [region, fuelType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Generator Bidding &amp; Offer Stack Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Generator offer price bands, rebidding activity, and bid stack analysis by fuel type
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        region={region}
        fuelType={fuelType}
        onRegionChange={setRegion}
        onFuelTypeChange={setFuelType}
      />

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {summary && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Offered MW"
              value={`${summary.total_offered_mw.toLocaleString()} MW`}
              subtitle="Across all filtered generators"
              icon={<Zap size={18} className="text-amber-600 dark:text-amber-400" />}
              accent="bg-amber-50 dark:bg-amber-900/20"
            />
            <KpiCard
              title="Average Offer Price"
              value={`$${summary.average_offer_price.toFixed(2)}/MWh`}
              subtitle="MW-weighted average"
              icon={<TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />}
              accent="bg-blue-50 dark:bg-blue-900/20"
            />
            <KpiCard
              title="Offers Below $50"
              value={`${summary.offers_below_50.toFixed(1)}%`}
              subtitle="MW priced at or below $50/MWh"
              icon={<BarChart2 size={18} className="text-green-600 dark:text-green-400" />}
              accent="bg-green-50 dark:bg-green-900/20"
            />
            <KpiCard
              title="Rebids Today"
              value={`${summary.total_rebids_today}`}
              subtitle="Total rebid submissions"
              icon={<AlertCircle size={18} className="text-red-600 dark:text-red-400" />}
              accent="bg-red-50 dark:bg-red-900/20"
            />
          </div>

          {/* Fuel type chart */}
          <FuelTypeChart breakdown={summary.fuel_type_breakdown} />

          {/* Generator offer records table */}
          <OfferRecordsTable records={summary.offer_records} />

          {/* Rebid log table */}
          <RebidLogTable rebids={summary.rebid_log} />
        </>
      )}
    </div>
  )
}
