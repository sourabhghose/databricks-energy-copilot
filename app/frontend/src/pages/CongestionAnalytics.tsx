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
} from 'recharts'
import { AlertOctagon, RefreshCw } from 'lucide-react'
import { api, CongestionDashboard, CongestionEvent, ConstraintRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CAUSE_COLOURS: Record<string, string> = {
  THERMAL:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  STABILITY: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  VOLTAGE:   'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  WEATHER:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
}

const TYPE_COLOURS: Record<string, string> = {
  'N-1':       'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'N-2':       'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  THERMAL:     'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  STABILITY:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  VOLTAGE:     'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
}

function Badge({ label, colourClass }: { label: string; colourClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colourClass}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ title, value, sub, accent = 'text-gray-900 dark:text-white' }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
        {title}
      </p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Congestion Cost Chart
// ---------------------------------------------------------------------------

function CongestionCostChart({ events }: { events: CongestionEvent[] }) {
  // Aggregate cost & rent per constraint_name
  const aggregated: Record<string, { cost: number; rent: number }> = {}
  events.forEach(e => {
    if (!aggregated[e.constraint_name]) aggregated[e.constraint_name] = { cost: 0, rent: 0 }
    aggregated[e.constraint_name].cost += e.congestion_cost_m_aud
    aggregated[e.constraint_name].rent += e.congestion_rent_m_aud
  })
  const data = Object.entries(aggregated).map(([name, vals]) => ({
    name,
    'Congestion Cost ($M)': Math.round(vals.cost * 100) / 100,
    'Congestion Rent ($M)': Math.round(vals.rent * 100) / 100,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Congestion Cost vs Rent by Interconnector ($M AUD)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF', paddingTop: 8 }} />
          <Bar dataKey="Congestion Cost ($M)" fill="#EF4444" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Congestion Rent ($M)" fill="#3B82F6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Events Table
// ---------------------------------------------------------------------------

const CAUSE_OPTIONS = ['ALL', 'THERMAL', 'STABILITY', 'VOLTAGE', 'WEATHER']
const REGION_OPTIONS = ['ALL', 'SA1', 'VIC1', 'NSW1', 'QLD1', 'TAS1']

function EventsTable({ events }: { events: CongestionEvent[] }) {
  const [causeFilter, setCauseFilter] = useState('ALL')
  const [regionFilter, setRegionFilter] = useState('ALL')

  const filtered = events.filter(e => {
    const matchCause = causeFilter === 'ALL' || e.cause === causeFilter
    const matchRegion = regionFilter === 'ALL' || e.region_from === regionFilter
    return matchCause && matchRegion
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Congestion Binding Events ({filtered.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {/* Cause filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {CAUSE_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setCauseFilter(opt)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  causeFilter === opt
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {/* Region filter */}
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="px-2.5 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 focus:outline-none"
          >
            {REGION_OPTIONS.map(r => (
              <option key={r} value={r}>{r === 'ALL' ? 'All Regions' : r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['Event ID', 'Constraint', 'From \u2192 To', 'Date', 'Duration (hrs)', 'Peak (MW)', 'Cost ($M)', 'Rent ($M)', 'Price Diff ($/MWh)', 'Cause'].map(h => (
                <th key={h} className="pb-2 pr-3 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.event_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-3 font-mono text-gray-600 dark:text-gray-400">{e.event_id}</td>
                <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-200 max-w-[160px] truncate" title={e.constraint_name}>{e.constraint_name}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{e.region_from} &rarr; {e.region_to}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{e.binding_date}</td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{e.duration_hours.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{e.peak_congestion_mw.toFixed(0)}</td>
                <td className="py-2 pr-3 text-right text-red-600 dark:text-red-400 font-medium">{e.congestion_cost_m_aud.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right text-blue-600 dark:text-blue-400 font-medium">{e.congestion_rent_m_aud.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{e.price_differential_aud_mwh.toFixed(2)}</td>
                <td className="py-2 pr-3">
                  <Badge label={e.cause} colourClass={CAUSE_COLOURS[e.cause] ?? 'bg-gray-100 text-gray-700'} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-gray-400 dark:text-gray-500">
                  No events match the selected filters
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
// Constraints Table
// ---------------------------------------------------------------------------

const TYPE_OPTIONS = ['ALL', 'N-1', 'N-2', 'THERMAL', 'STABILITY', 'VOLTAGE']

function ConstraintsTable({ constraints }: { constraints: ConstraintRecord[] }) {
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const filtered = constraints.filter(c => {
    const matchRegion = regionFilter === 'ALL' || c.region === regionFilter
    const matchType = typeFilter === 'ALL' || c.type === typeFilter
    return matchRegion && matchType
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          NEM Constraint Equations ({filtered.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {/* Region filter */}
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="px-2.5 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 focus:outline-none"
          >
            {REGION_OPTIONS.map(r => (
              <option key={r} value={r}>{r === 'ALL' ? 'All Regions' : r}</option>
            ))}
          </select>
          {/* Type filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setTypeFilter(opt)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  typeFilter === opt
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['Constraint ID', 'Name', 'LHS Description', 'RHS (MW)', 'Flow (MW)', 'Flow %', 'Binding Freq %', 'Annual Cost $M', 'Type'].map(h => (
                <th key={h} className="pb-2 pr-3 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const flowPct = c.rhs_value_mw > 0 ? (c.current_flow_mw / c.rhs_value_mw) * 100 : 0
              const isHighFlow = flowPct > 90
              return (
                <tr key={c.constraint_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-3 font-mono text-gray-600 dark:text-gray-400 text-xs max-w-[120px] truncate" title={c.constraint_id}>{c.constraint_id}</td>
                  <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-200 max-w-[160px] truncate" title={c.constraint_name}>{c.constraint_name}</td>
                  <td className="py-2 pr-3 text-gray-500 dark:text-gray-400 max-w-[160px] truncate" title={c.lhs_description}>{c.lhs_description}</td>
                  <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{c.rhs_value_mw.toFixed(0)}</td>
                  <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{c.current_flow_mw.toFixed(0)}</td>
                  <td className={`py-2 pr-3 text-right font-semibold ${isHighFlow ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {flowPct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{c.binding_frequency_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-3 text-right text-orange-600 dark:text-orange-400 font-medium">{c.annual_congestion_cost_m_aud.toFixed(1)}</td>
                  <td className="py-2 pr-3">
                    <Badge label={c.type} colourClass={TYPE_COLOURS[c.type] ?? 'bg-gray-100 text-gray-700'} />
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400 dark:text-gray-500">
                  No constraints match the selected filters
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
// Main Page
// ---------------------------------------------------------------------------

export default function CongestionAnalytics() {
  const [dashboard, setDashboard] = useState<CongestionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCongestionDashboard()
      setDashboard(data)
      setLastRefresh(new Date())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load congestion data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertOctagon className="text-red-600 dark:text-red-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Network Congestion & Constraint Binding Analytics
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              NEM constraint binding events, congestion costs, congestion rent, and constraint equation analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {lastRefresh.toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !dashboard && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={28} className="animate-spin text-red-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading congestion data...</p>
          </div>
        </div>
      )}

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Events YTD"
              value={dashboard.total_events_ytd.toString()}
              sub="Binding constraint events"
              accent="text-red-600 dark:text-red-400"
            />
            <KpiCard
              title="Total Congestion Cost"
              value={`$${dashboard.total_congestion_cost_m_aud.toFixed(1)}M`}
              sub="AUD year-to-date"
              accent="text-orange-600 dark:text-orange-400"
            />
            <KpiCard
              title="Congestion Rent"
              value={`$${dashboard.total_congestion_rent_m_aud.toFixed(1)}M`}
              sub="AUD year-to-date"
              accent="text-blue-600 dark:text-blue-400"
            />
            <KpiCard
              title="Avg Event Duration"
              value={`${dashboard.avg_event_duration_h.toFixed(1)} hrs`}
              sub={`Most binding: ${dashboard.most_binding_constraint}`}
              accent="text-purple-600 dark:text-purple-400"
            />
          </div>

          {/* Congestion Cost Chart */}
          <CongestionCostChart events={dashboard.events} />

          {/* Events Table */}
          <EventsTable events={dashboard.events} />

          {/* Constraints Table */}
          <ConstraintsTable constraints={dashboard.constraints} />
        </>
      )}
    </div>
  )
}
