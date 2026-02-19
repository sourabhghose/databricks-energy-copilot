import { useEffect, useState } from 'react'
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
import { DollarSign, AlertTriangle, TrendingUp, Activity } from 'lucide-react'
import { api, TuosDashboard, TuosZone, MlfRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const TNSP_COLOURS: Record<string, string> = {
  TransGrid:   '#3b82f6', // blue-500
  AusNet:      '#a855f7', // purple-500
  Powerlink:   '#f59e0b', // amber-500
  ElectraNet:  '#22c55e', // green-500
  TasNetworks: '#06b6d4', // cyan-500
}

function tnspColour(tnsp: string): string {
  return TNSP_COLOURS[tnsp] ?? '#6b7280'
}

function mlfColour(value: number): string {
  if (value >= 1.01) return 'text-green-600 dark:text-green-400'
  if (value <= 0.97) return 'text-red-600 dark:text-red-400'
  return 'text-amber-600 dark:text-amber-400'
}

function mlfBadgeClass(category: string): string {
  if (category === 'HIGH')    return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (category === 'LOW')     return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
}

function fuelBadgeClass(fuel: string): string {
  const map: Record<string, string> = {
    BLACK_COAL: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    BROWN_COAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    GAS_CCGT:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    HYDRO:      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
    WIND:       'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    SOLAR:      'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  }
  return map[fuel] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ label, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 flex items-start gap-4 shadow-sm">
      <div className={`rounded-lg p-3 ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-72" />
      <Skeleton className="h-72" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// TUoS Rates Bar Chart
// ---------------------------------------------------------------------------

interface RatesChartProps {
  zones: TuosZone[]
}

function RatesChart({ zones }: RatesChartProps) {
  const data = zones.map(z => ({
    name: z.zone_name,
    rate: z.tuos_rate_kwh,
    tnsp: z.tnsp,
  }))

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          TUoS Rates by Zone ($/kWh)
        </h2>
      </div>
      {/* TNSP legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(TNSP_COLOURS).map(([tnsp, colour]) => (
          <div key={tnsp} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: colour }} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{tnsp}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tickFormatter={v => `$${v.toFixed(4)}`}
            tick={{ fontSize: 11 }}
            width={72}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(4)}/kWh`, 'TUoS Rate']}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="rate" name="TUoS Rate ($/kWh)" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={tnspColour(entry.tnsp)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zones Table
// ---------------------------------------------------------------------------

const STATE_OPTIONS = ['ALL', 'NSW', 'VIC', 'QLD', 'SA', 'TAS']

interface ZonesTableProps {
  zones: TuosZone[]
}

function ZonesTable({ zones }: ZonesTableProps) {
  const [stateFilter, setStateFilter] = useState('ALL')

  const filtered = stateFilter === 'ALL'
    ? zones
    : zones.filter(z => z.state === stateFilter)

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-green-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            TUoS Pricing Zones
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400">State:</span>
          {STATE_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                stateFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['Zone', 'TNSP', 'State', 'TUoS Rate ($/kWh)', 'Annual Revenue ($M)', 'Customers', 'Peak MW', 'Network km'].map(h => (
                <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(z => (
              <tr
                key={z.zone_id}
                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{z.zone_name}</td>
                <td className="py-2.5 px-3">
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: tnspColour(z.tnsp) }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: tnspColour(z.tnsp) }}
                    />
                    {z.tnsp}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{z.state}</td>
                <td className="py-2.5 px-3 font-mono text-blue-700 dark:text-blue-400">${z.tuos_rate_kwh.toFixed(4)}</td>
                <td className="py-2.5 px-3 font-mono text-gray-800 dark:text-gray-200">${z.annual_charge_m_aud.toFixed(1)}M</td>
                <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{z.customer_count.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{z.peak_demand_mw.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{z.network_length_km.toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No zones found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MLF Table
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = ['ALL', 'HIGH', 'AVERAGE', 'LOW']

interface MlfTableProps {
  records: MlfRecord[]
}

function MlfTable({ records }: MlfTableProps) {
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [stateFilter, setStateFilter] = useState('ALL')

  const filtered = records.filter(r => {
    const catOk = categoryFilter === 'ALL' || r.mlf_category === categoryFilter
    const stateOk = stateFilter === 'ALL' || r.state === stateFilter
    return catOk && stateOk
  })

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Marginal Loss Factors (MLF) — FY 2024-25
          </h2>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Category:</span>
            {CATEGORY_OPTIONS.map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={[
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  categoryFilter === c
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ].join(' ')}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">State:</span>
            {STATE_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setStateFilter(s)}
                className={[
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  stateFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['DUID', 'Generator', 'State', 'Fuel Type', 'MLF Value', 'Category', 'Revenue Impact ($M)'].map(h => (
                <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr
                key={r.duid}
                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="py-2.5 px-3 font-mono text-xs font-medium text-gray-900 dark:text-gray-100">{r.duid}</td>
                <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 whitespace-nowrap">{r.generator_name}</td>
                <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{r.state}</td>
                <td className="py-2.5 px-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${fuelBadgeClass(r.fuel_type)}`}>
                    {r.fuel_type.replace('_', ' ')}
                  </span>
                </td>
                <td className={`py-2.5 px-3 font-mono font-semibold ${mlfColour(r.mlf_value)}`}>
                  {r.mlf_value.toFixed(4)}
                </td>
                <td className="py-2.5 px-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${mlfBadgeClass(r.mlf_category)}`}>
                    {r.mlf_category}
                  </span>
                </td>
                <td className={`py-2.5 px-3 font-mono font-medium ${r.revenue_impact_m_aud >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {r.revenue_impact_m_aud >= 0 ? '+' : ''}{r.revenue_impact_m_aud.toFixed(2)}M
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No records found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TuosAnalytics() {
  const [data, setData] = useState<TuosDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getTuosDashboard()
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(err => {
        setError(err?.message ?? 'Failed to load TUoS data')
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg bg-green-100 dark:bg-green-900/40 p-2.5">
          <DollarSign size={22} className="text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            TNSP Network Pricing (TUoS) Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Transmission Use of System charges, locational pricing and Marginal Loss Factor analysis — NEM
          </p>
        </div>
        {data && (
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            Updated: {data.timestamp}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-center gap-3 mb-6">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && <DashboardSkeleton />}

      {/* Content */}
      {!loading && data && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Total TUoS Revenue"
              value={`$${data.total_tuos_revenue_m_aud.toFixed(0)}M`}
              sub="Annual network charges"
              icon={<DollarSign size={20} className="text-green-600 dark:text-green-400" />}
              accent="bg-green-100 dark:bg-green-900/40"
            />
            <KpiCard
              label="Avg TUoS Rate"
              value={`$${data.avg_tuos_rate_kwh.toFixed(4)}/kWh`}
              sub="Across all zones"
              icon={<TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />}
              accent="bg-blue-100 dark:bg-blue-900/40"
            />
            <KpiCard
              label="Pricing Zones"
              value={String(data.zones_count)}
              sub="Across 5 TNSPs"
              icon={<Activity size={20} className="text-purple-600 dark:text-purple-400" />}
              accent="bg-purple-100 dark:bg-purple-900/40"
            />
            <KpiCard
              label="Avg MLF"
              value={data.avg_mlf.toFixed(4)}
              sub="FY 2024-25"
              icon={<AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />}
              accent="bg-amber-100 dark:bg-amber-900/40"
            />
          </div>

          {/* TUoS Rates Chart */}
          <RatesChart zones={data.zones} />

          {/* Zones Table */}
          <ZonesTable zones={data.zones} />

          {/* MLF Table */}
          <MlfTable records={data.mlf_records} />
        </div>
      )}
    </div>
  )
}
