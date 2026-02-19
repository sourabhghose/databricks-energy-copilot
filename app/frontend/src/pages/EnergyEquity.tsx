import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
} from 'recharts'
import { Heart, AlertCircle, Loader2 } from 'lucide-react'
import { api, EquityDashboard, EnergyHardshipRecord, AffordabilityIndicator } from '../api/client'

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function demographicBadge(demo: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (demo) {
    case 'LOW_INCOME':  return <span className={`${base} bg-red-800 text-red-100`}>LOW INCOME</span>
    case 'RURAL':       return <span className={`${base} bg-amber-700 text-amber-100`}>RURAL</span>
    case 'INDIGENOUS':  return <span className={`${base} bg-purple-800 text-purple-100`}>INDIGENOUS</span>
    case 'RENTER':      return <span className={`${base} bg-blue-800 text-blue-100`}>RENTER</span>
    case 'ELDERLY':     return <span className={`${base} bg-teal-700 text-teal-100`}>ELDERLY</span>
    default:            return <span className={`${base} bg-gray-600 text-gray-200`}>{demo}</span>
  }
}

function hardshipRateColor(rate: number): string {
  if (rate > 6) return 'text-red-400 font-bold'
  if (rate > 4) return 'text-amber-400 font-semibold'
  return 'text-green-400'
}

function burdenColor(burden: number): string {
  if (burden > 12) return 'text-red-400 font-bold'
  if (burden > 8)  return 'text-amber-400 font-semibold'
  return 'text-green-400'
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  color?: string
}

function KpiCard({ label, value, sub, color = 'text-white' }: KpiProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-400 text-xs">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hardship Rate Bar Chart with Disconnection Rate Line
// ---------------------------------------------------------------------------

function HardshipRateChart({ records }: { records: EnergyHardshipRecord[] }) {
  const data = records.map(r => ({
    state: r.state,
    hardship_rate: r.hardship_rate_pct,
    disc_per_1000: r.disconnection_rate_per_1000,
    fill: r.hardship_rate_pct > 6 ? '#ef4444' : r.hardship_rate_pct > 4 ? '#f59e0b' : '#22c55e',
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-gray-200 font-semibold mb-4 text-sm uppercase tracking-wide">
        Hardship Rate (%) & Disconnection Rate per 1,000 by State
      </h2>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 40, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            yAxisId="rate"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Hardship Rate %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            yAxisId="disc"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Disc / 1000', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ paddingTop: 12, color: '#9ca3af', fontSize: 12 }} />
          {data.map(d => (
            <Bar
              key={d.state}
              yAxisId="rate"
              dataKey="hardship_rate"
              name="Hardship Rate %"
              fill={d.fill}
              hide={false}
            />
          ))}
          <Bar yAxisId="rate" dataKey="hardship_rate" name="Hardship Rate %" fill="#6b7280" hide />
          <Line
            yAxisId="disc"
            type="monotone"
            dataKey="disc_per_1000"
            name="Disc / 1,000"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 4, fill: '#60a5fa' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Hardship &gt; 6%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Hardship 4–6%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Hardship &lt; 4%</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hardship Records Table
// ---------------------------------------------------------------------------

const ALL_STATES_OPTIONS = ['ALL', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']

function HardshipTable({ records }: { records: EnergyHardshipRecord[] }) {
  const [stateFilter, setStateFilter] = useState('ALL')

  const filtered = stateFilter === 'ALL' ? records : records.filter(r => r.state === stateFilter)

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-gray-200 font-semibold text-sm uppercase tracking-wide">
          State Hardship Records
        </h2>
        <div className="flex gap-1 flex-wrap">
          {ALL_STATES_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                stateFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 px-2">State</th>
              <th className="text-right py-2 px-2">Customers</th>
              <th className="text-right py-2 px-2">Hardship Rate %</th>
              <th className="text-right py-2 px-2">Disconnections</th>
              <th className="text-right py-2 px-2">Disc / 1,000</th>
              <th className="text-right py-2 px-2">Avg Bill $</th>
              <th className="text-right py-2 px-2">Concessions</th>
              <th className="text-right py-2 px-2">Conc Value $M</th>
              <th className="text-right py-2 px-2">Solar %</th>
              <th className="text-right py-2 px-2">Tariff $/kWh</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.state} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 px-2 font-semibold text-white">{r.state}</td>
                <td className="py-2 px-2 text-right text-gray-300">{r.residential_customers.toLocaleString()}</td>
                <td className={`py-2 px-2 text-right ${hardshipRateColor(r.hardship_rate_pct)}`}>
                  {r.hardship_rate_pct.toFixed(1)}%
                </td>
                <td className="py-2 px-2 text-right text-gray-300">{r.disconnections.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-300">{r.disconnection_rate_per_1000.toFixed(1)}</td>
                <td className="py-2 px-2 text-right text-gray-300">${r.avg_bill_aud.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-300">{r.concession_recipients.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-300">${r.concession_value_m_aud.toFixed(1)}M</td>
                <td className="py-2 px-2 text-right text-gray-300">{r.solar_penetration_pct.toFixed(1)}%</td>
                <td className="py-2 px-2 text-right text-gray-300">${r.avg_retail_tariff_kwh.toFixed(4)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-gray-500">No records found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Affordability Indicators Table
// ---------------------------------------------------------------------------

const ALL_DEMOGRAPHICS = ['ALL', 'LOW_INCOME', 'RURAL', 'INDIGENOUS', 'RENTER', 'ELDERLY']
const ALL_REGIONS_OPTIONS = ['ALL', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']

function AffordabilityTable({ indicators }: { indicators: AffordabilityIndicator[] }) {
  const [demoFilter, setDemoFilter] = useState('ALL')
  const [regionFilter, setRegionFilter] = useState('ALL')

  const filtered = indicators.filter(i => {
    if (demoFilter !== 'ALL' && i.demographic !== demoFilter) return false
    if (regionFilter !== 'ALL' && i.region !== regionFilter) return false
    return true
  })

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-gray-200 font-semibold text-sm uppercase tracking-wide">
          Affordability Indicators by Demographic
        </h2>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 flex-wrap items-center">
            <span className="text-xs text-gray-400 mr-1">Demographic:</span>
            {ALL_DEMOGRAPHICS.map(d => (
              <button
                key={d}
                onClick={() => setDemoFilter(d)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  demoFilter === d
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {d === 'ALL' ? 'ALL' : d.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap items-center">
            <span className="text-xs text-gray-400 mr-1">Region:</span>
            {ALL_REGIONS_OPTIONS.map(r => (
              <button
                key={r}
                onClick={() => setRegionFilter(r)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  regionFilter === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 px-2">Region</th>
              <th className="text-left py-2 px-2">Demographic</th>
              <th className="text-right py-2 px-2">Energy Burden %</th>
              <th className="text-right py-2 px-2">Digital Excl %</th>
              <th className="text-right py-2 px-2">Summer Bill $</th>
              <th className="text-right py-2 px-2">Winter Bill $</th>
              <th className="text-right py-2 px-2">Avg Concession $</th>
              <th className="text-right py-2 px-2">Hardship Debt $</th>
              <th className="text-right py-2 px-2">Payment Plan %</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.indicator_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 px-2 font-semibold text-white">{i.region}</td>
                <td className="py-2 px-2">{demographicBadge(i.demographic)}</td>
                <td className={`py-2 px-2 text-right ${burdenColor(i.energy_burden_pct)}`}>
                  {i.energy_burden_pct.toFixed(1)}%
                </td>
                <td className="py-2 px-2 text-right text-gray-300">{i.digital_exclusion_pct.toFixed(1)}%</td>
                <td className="py-2 px-2 text-right text-gray-300">${i.summer_bill_aud.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-amber-300">${i.winter_bill_aud.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-green-400">${i.avg_concession_aud.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-red-400">${i.hardship_debt_avg_aud.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-blue-300">{i.payment_plan_uptake_pct.toFixed(1)}%</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-gray-500">No indicators found</td>
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

export default function EnergyEquity() {
  const [dashboard, setDashboard] = useState<EquityDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .getEquityDashboard()
      .then(d => {
        setDashboard(d)
        setLoading(false)
      })
      .catch(err => {
        setError(err?.message ?? 'Failed to load equity dashboard')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading equity data…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertCircle size={20} />
        <span>{error ?? 'No data available'}</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Heart className="text-rose-400" size={24} />
        <div>
          <h1 className="text-xl font-bold text-white">Energy Poverty &amp; Social Equity Analytics</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Hardship programs, concessions, disconnections and affordability — Australia-wide
            <span className="ml-2 text-gray-500">Updated {dashboard.timestamp}</span>
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Avg National Hardship Rate"
          value={`${dashboard.national_avg_hardship_rate_pct.toFixed(2)}%`}
          sub="% of residential customers"
          color={dashboard.national_avg_hardship_rate_pct > 6 ? 'text-red-400' : dashboard.national_avg_hardship_rate_pct > 4 ? 'text-amber-400' : 'text-green-400'}
        />
        <KpiCard
          label="Avg Disconnection Rate"
          value={`${dashboard.national_disconnection_rate.toFixed(1)}`}
          sub="per 1,000 residential customers"
          color="text-amber-400"
        />
        <KpiCard
          label="Total Concession Value"
          value={`$${dashboard.total_concession_value_m_aud.toFixed(0)}M`}
          sub="AUD — all states combined"
          color="text-green-400"
        />
        <KpiCard
          label="Hardship Program Customers"
          value={dashboard.hardship_customers.toLocaleString()}
          sub="enrolled in retailer hardship programs"
          color="text-blue-300"
        />
      </div>

      {/* Hardship Rate Chart */}
      <HardshipRateChart records={dashboard.hardship_records} />

      {/* Hardship Records Table */}
      <HardshipTable records={dashboard.hardship_records} />

      {/* Affordability Indicators Table */}
      <AffordabilityTable indicators={dashboard.affordability_indicators} />
    </div>
  )
}
