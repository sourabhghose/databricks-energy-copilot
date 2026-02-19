import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { Zap, RefreshCw, AlertCircle, Info } from 'lucide-react'
import { api, WemDashboard, WemBalancingPrice, WemFacility, WemSrMcRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Technology badge colour map
// ---------------------------------------------------------------------------
const TECH_COLOURS: Record<string, string> = {
  COAL:     'bg-gray-500 text-white',
  GAS_GT:   'bg-orange-500 text-white',
  GAS_CCGT: 'bg-amber-500 text-white',
  WIND:     'bg-sky-500 text-white',
  SOLAR:    'bg-yellow-400 text-gray-900',
  BATTERY:  'bg-green-500 text-white',
  GAS_COGEN:'bg-purple-500 text-white',
}

const TECH_FILTER_OPTIONS = ['ALL', 'COAL', 'GAS_GT', 'GAS_CCGT', 'WIND', 'SOLAR', 'BATTERY', 'GAS_COGEN']

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  colour?: string
}

function KpiCard({ title, value, subtitle, colour = 'text-gray-900 dark:text-gray-100' }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </span>
      <span className={`text-2xl font-bold ${colour}`}>{value}</span>
      {subtitle && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Balancing Price Chart
// ---------------------------------------------------------------------------
interface BalancingPriceChartProps {
  prices: WemBalancingPrice[]
  mcap: number
}

function BalancingPriceChart({ prices, mcap }: BalancingPriceChartProps) {
  const data = prices.map((p) => ({
    interval: p.trading_interval.substring(11, 16),
    balancing: p.balancing_price_aud,
    reference: p.reference_price_aud,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Balancing Price vs Reference Price (48 Trading Intervals)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="interval"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            interval={5}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickFormatter={(v) => `$${v}`}
            domain={[0, mcap + 20]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#F9FAFB',
            }}
            formatter={(value: number, name: string) => [
              `$${value.toFixed(2)}/MWh`,
              name === 'balancing' ? 'Balancing Price' : 'Reference Price',
            ]}
          />
          <Legend
            formatter={(value) =>
              value === 'balancing' ? 'Balancing Price' : 'Reference Price'
            }
            wrapperStyle={{ fontSize: '12px' }}
          />
          <ReferenceLine
            y={mcap}
            stroke="#EF4444"
            strokeDasharray="4 4"
            label={{ value: `MCAP $${mcap}`, position: 'right', fontSize: 10, fill: '#EF4444' }}
          />
          <Line
            type="monotone"
            dataKey="balancing"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="reference"
            stroke="#F59E0B"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Facility Table
// ---------------------------------------------------------------------------
interface FacilityTableProps {
  facilities: WemFacility[]
}

function FacilityTable({ facilities }: FacilityTableProps) {
  const [techFilter, setTechFilter] = useState<string>('ALL')

  const filtered =
    techFilter === 'ALL'
      ? facilities
      : facilities.filter((f) => f.technology === techFilter)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-1">
          Registered Facilities ({filtered.length} / {facilities.length})
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {TECH_FILTER_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTechFilter(t)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                techFilter === t
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              {[
                'Facility Name',
                'Participant',
                'Technology',
                'Reg. MW',
                'Acc. MW',
                'Cap. Credit MW',
                'Balancing',
                'Year',
              ].map((h) => (
                <th
                  key={h}
                  className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr
                key={f.facility_id}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <td className="py-2 px-2 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">
                  {f.facility_name}
                </td>
                <td className="py-2 px-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {f.participant}
                </td>
                <td className="py-2 px-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      TECH_COLOURS[f.technology] ?? 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {f.technology}
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-200">
                  {f.registered_capacity_mw.toFixed(0)}
                </td>
                <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-200">
                  {f.accredited_capacity_mw.toFixed(0)}
                </td>
                <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-200">
                  {f.capacity_credit_mw.toFixed(0)}
                </td>
                <td className="py-2 px-2 text-center">
                  {f.balancing_flag ? (
                    <span className="text-green-500 font-bold">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </td>
                <td className="py-2 px-2 text-center text-gray-600 dark:text-gray-300">
                  {f.commissioning_year}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
            No facilities match the selected technology filter.
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reserve Capacity (SRMC) Chart
// ---------------------------------------------------------------------------
interface SrmcChartProps {
  records: WemSrMcRecord[]
}

function SrmcChart({ records }: SrmcChartProps) {
  const data = records.map((r) => ({
    year: r.year,
    certified: Math.round(r.certified_reserve_capacity_mw),
    required: Math.round(r.reserve_capacity_requirement_mw),
    surplus: Math.round(r.surplus_deficit_mw),
    srmc: r.srmc_aud_per_mwh,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Reserve Capacity Mechanism — Certified vs Required (MW)
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#F9FAFB',
            }}
            formatter={(value: number, name: string) => [
              `${value.toLocaleString()} MW`,
              name === 'certified' ? 'Certified Reserve Capacity' : 'Reserve Capacity Requirement',
            ]}
          />
          <Legend
            formatter={(value) =>
              value === 'certified'
                ? 'Certified Reserve Capacity'
                : 'Reserve Capacity Requirement'
            }
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Bar dataKey="certified" fill="#3B82F6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="required" fill="#F59E0B" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              {['Year', 'Surplus / Deficit MW', 'SRMC $/MWh', 'RCP Outcome $', 'Facilities'].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left py-1.5 px-2 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr
                key={r.year}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <td className="py-1.5 px-2 font-medium text-gray-800 dark:text-gray-100">
                  {r.year}
                </td>
                <td className="py-1.5 px-2">
                  <span
                    className={
                      r.surplus_deficit_mw >= 0
                        ? 'text-green-600 dark:text-green-400 font-semibold'
                        : 'text-red-600 dark:text-red-400 font-semibold'
                    }
                  >
                    {r.surplus_deficit_mw >= 0 ? '+' : ''}
                    {r.surplus_deficit_mw.toFixed(0)} MW
                  </span>
                </td>
                <td className="py-1.5 px-2 text-gray-700 dark:text-gray-200">
                  ${r.srmc_aud_per_mwh.toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-gray-700 dark:text-gray-200">
                  ${(r.rcp_outcome_aud / 1000).toFixed(0)}k
                </td>
                <td className="py-1.5 px-2 text-center text-gray-600 dark:text-gray-300">
                  {r.num_accredited_facilities}
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
// Context note
// ---------------------------------------------------------------------------
function WemContextNote() {
  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 flex gap-3">
      <Info size={18} className="text-purple-500 shrink-0 mt-0.5" />
      <p className="text-xs text-purple-800 dark:text-purple-300 leading-relaxed">
        <span className="font-semibold">WEM Context:</span> WEM is Western Australia&apos;s
        isolated electricity market operated by AEMO. Market price cap (MCAP) is{' '}
        <span className="font-semibold">$300/MWh</span> vs NEM&apos;s $15,500/MWh. Reserve
        Capacity Mechanism (RCM) ensures reliability by requiring participants to hold
        accredited capacity. Short Run Marginal Cost (SRMC) informs the balancing merit order.
        The WEM is not interconnected with the NEM and operates under separate market rules.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main WemOverview component
// ---------------------------------------------------------------------------
export default function WemOverview() {
  const [dashboard, setDashboard] = useState<WemDashboard | null>(null)
  const [prices, setPrices] = useState<WemBalancingPrice[]>([])
  const [facilities, setFacilities] = useState<WemFacility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, priceData, facilityData] = await Promise.all([
        api.getWemDashboard(),
        api.getWemPrices(),
        api.getWemFacilities(),
      ])
      setDashboard(dash)
      setPrices(priceData)
      setFacilities(facilityData)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load WEM data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    const timer = setInterval(fetchAll, 300_000)
    return () => clearInterval(timer)
  }, [])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={24} className="text-purple-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading WEM data...</p>
        </div>
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <AlertCircle size={24} className="text-red-500" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchAll}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const dash = dashboard!

  const priceColour =
    dash.current_balancing_price_aud >= dash.mcap_aud
      ? 'text-red-500'
      : dash.current_balancing_price_aud >= dash.mcap_aud * 0.8
      ? 'text-amber-500'
      : 'text-green-500'

  const renewableColour =
    dash.renewable_penetration_pct >= 40
      ? 'text-green-500'
      : dash.renewable_penetration_pct >= 20
      ? 'text-amber-500'
      : 'text-gray-700 dark:text-gray-200'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Zap size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                WEM — Western Australia Energy Market
              </h1>
              <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                WEM
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Operated by AEMO · Isolated from NEM · MCAP $300/MWh
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Last updated:{' '}
            {lastRefresh.toLocaleTimeString('en-AU', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Context note */}
      <WemContextNote />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Current Balancing Price"
          value={`$${dash.current_balancing_price_aud.toFixed(2)}`}
          subtitle={`MCAP: $${dash.mcap_aud.toFixed(0)}/MWh`}
          colour={priceColour}
        />
        <KpiCard
          title="Current Load"
          value={`${dash.current_load_mw.toFixed(0)} MW`}
          subtitle={`Total registered: ${dash.total_registered_capacity_mw.toFixed(0)} MW`}
        />
        <KpiCard
          title="Spinning Reserve"
          value={`${dash.spinning_reserve_mw.toFixed(0)} MW`}
          subtitle={`${dash.num_registered_facilities} registered facilities`}
        />
        <KpiCard
          title="Renewable Penetration"
          value={`${dash.renewable_penetration_pct.toFixed(1)}%`}
          subtitle="Wind + Solar + BESS capacity"
          colour={renewableColour}
        />
      </div>

      {/* Balancing Price Chart */}
      <BalancingPriceChart
        prices={prices.length > 0 ? prices : dash.balancing_prices}
        mcap={dash.mcap_aud}
      />

      {/* Facility Table */}
      <FacilityTable facilities={facilities.length > 0 ? facilities : dash.facilities} />

      {/* Reserve Capacity (SRMC) Chart */}
      <SrmcChart records={dash.srmc_records} />

      {/* Summary stats footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Reference Price',
            value: `$${dash.reference_price_aud.toFixed(2)}/MWh`,
          },
          {
            label: 'Total Registered Capacity',
            value: `${dash.total_registered_capacity_mw.toFixed(0)} MW`,
          },
          {
            label: 'Registered Facilities',
            value: `${dash.num_registered_facilities}`,
          },
          {
            label: 'Data Timestamp',
            value:
              new Date(dash.timestamp).toLocaleTimeString('en-AU', {
                timeZone: 'Australia/Perth',
                hour: '2-digit',
                minute: '2-digit',
              }) + ' AWST',
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
