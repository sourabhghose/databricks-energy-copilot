import React, { useEffect, useState } from 'react'
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
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingDown,
  AlertTriangle,
  Battery,
  Zap,
  RefreshCw,
  Wind,
  Sun,
  DollarSign,
} from 'lucide-react'
import {
  getNegativePriceEventsDashboard,
  NPEDashboard,
  NPEFrequencyRecord,
  NPEDriverRecord,
  NPEBatteryOpportunityRecord,
  NPEMustRunRecord,
  NPEMarketDesignRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  IMPLEMENTED:  'bg-green-700 text-white',
  PROPOSED:     'bg-blue-700 text-white',
  UNDER_REVIEW: 'bg-amber-600 text-white',
  REJECTED:     'bg-red-700 text-white',
}

const TECH_BADGE: Record<string, string> = {
  COAL:         'bg-gray-600 text-white',
  GAS:          'bg-orange-600 text-white',
  NUCLEAR_HYDRO:'bg-teal-700 text-white',
  COGENERATION: 'bg-violet-700 text-white',
}

const REGION_COLOUR: Record<string, string> = {
  SA1:   '#F59E0B',
  VIC1:  '#3B82F6',
  NSW1:  '#10B981',
  QLD1:  '#EF4444',
  TAS1:  '#8B5CF6',
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ElementType
  accent?: string
}) {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border-l-4 ${accent ?? 'border-blue-500'}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-gray-400" />}
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-800 rounded-lg p-5">
      <h2 className="text-base font-semibold text-white mb-4">{title}</h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Frequency Trends — LineChart (negative intervals by region/year)
// ---------------------------------------------------------------------------

function FrequencyTrendsChart({ data }: { data: NPEFrequencyRecord[] }) {
  const REGIONS = ['SA1', 'VIC1', 'NSW1', 'QLD1', 'TAS1']
  const YEARS   = [2018, 2019, 2020, 2021, 2022, 2023, 2024]

  const chartData = YEARS.map((yr) => {
    const row: Record<string, number | string> = { year: yr.toString() }
    REGIONS.forEach((r) => {
      const rec = data.find((d) => d.year === yr && d.region === r)
      row[r] = rec ? rec.negative_price_intervals : 0
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }}
          formatter={(v: number) => [`${v.toLocaleString()} intervals`, '']}
        />
        <Legend wrapperStyle={{ color: '#D1D5DB', fontSize: 12 }} />
        {REGIONS.map((r) => (
          <Line
            key={r}
            type="monotone"
            dataKey={r}
            stroke={REGION_COLOUR[r]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Drivers Breakdown — Stacked BarChart by source per quarter
// ---------------------------------------------------------------------------

const DRIVER_KEYS = [
  { key: 'rooftop_solar_contribution_pct', label: 'Rooftop Solar',     color: '#F59E0B' },
  { key: 'wind_contribution_pct',          label: 'Wind',               color: '#3B82F6' },
  { key: 'must_run_baseload_pct',          label: 'Must-Run Baseload',  color: '#6B7280' },
  { key: 'pumped_hydro_pct',               label: 'Pumped Hydro',       color: '#06B6D4' },
  { key: 'low_demand_pct',                 label: 'Low Demand',         color: '#8B5CF6' },
  { key: 'combined_export_constraint_pct', label: 'Export Constraint',  color: '#EF4444' },
]

function DriversBreakdownChart({ data, region }: { data: NPEDriverRecord[]; region: string }) {
  const filtered = data.filter((d) => d.region === region)
  const chartData = filtered.map((d) => ({
    quarter: d.quarter,
    'Rooftop Solar':    d.rooftop_solar_contribution_pct,
    Wind:               d.wind_contribution_pct,
    'Must-Run Baseload':d.must_run_baseload_pct,
    'Pumped Hydro':     d.pumped_hydro_pct,
    'Low Demand':       d.low_demand_pct,
    'Export Constraint':d.combined_export_constraint_pct,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 40, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="quarter" tick={{ fill: '#9CA3AF', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} unit="%" domain={[0, 100]} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }}
          formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
        />
        <Legend wrapperStyle={{ color: '#D1D5DB', fontSize: 12 }} />
        {DRIVER_KEYS.map((dk) => (
          <Bar key={dk.key} dataKey={dk.label} stackId="a" fill={dk.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Battery Opportunity — BarChart arbitrage value by region
// ---------------------------------------------------------------------------

function BatteryOpportunityChart({ data }: { data: NPEBatteryOpportunityRecord[] }) {
  const REGIONS = ['SA1', 'VIC1', 'NSW1', 'QLD1', 'TAS1']
  const YEARS   = [2022, 2023, 2024]

  const chartData = REGIONS.map((r) => {
    const row: Record<string, number | string> = { region: r }
    YEARS.forEach((yr) => {
      const rec = data.find((d) => d.region === r && d.year === yr)
      row[yr.toString()] = rec ? rec.optimal_charge_value_m : 0
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="region" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={(v) => `$${v}M`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F9FAFB' }}
          formatter={(v: number) => [`$${v.toFixed(1)}M`, '']}
        />
        <Legend wrapperStyle={{ color: '#D1D5DB', fontSize: 12 }} />
        <Bar dataKey="2022" fill="#6B7280" radius={[3, 3, 0, 0]} />
        <Bar dataKey="2023" fill="#3B82F6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="2024" fill="#10B981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Must-Run Plant Table
// ---------------------------------------------------------------------------

function MustRunTable({ data }: { data: NPEMustRunRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase">
            <th className="py-2 pr-4">Plant</th>
            <th className="py-2 pr-4">Technology</th>
            <th className="py-2 pr-4">Region</th>
            <th className="py-2 pr-4 text-right">Min Stable (MW)</th>
            <th className="py-2 pr-4 text-right">Tech Min (MW)</th>
            <th className="py-2 pr-4 text-right">Ramp (MW/min)</th>
            <th className="py-2 pr-4 text-right">Neg. Hrs/yr</th>
            <th className="py-2 text-right">Est. Loss (M/yr)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.plant_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
              <td className="py-2 pr-4 font-medium text-white">{r.plant_name}</td>
              <td className="py-2 pr-4">
                <Badge label={r.technology} colorClass={TECH_BADGE[r.technology] ?? 'bg-gray-700 text-white'} />
              </td>
              <td className="py-2 pr-4">
                <span style={{ color: REGION_COLOUR[r.region] ?? '#9CA3AF' }} className="font-semibold text-xs">
                  {r.region}
                </span>
              </td>
              <td className="py-2 pr-4 text-right text-gray-300">{r.min_stable_load_mw.toFixed(0)}</td>
              <td className="py-2 pr-4 text-right text-gray-300">{r.technical_min_mw.toFixed(0)}</td>
              <td className="py-2 pr-4 text-right text-gray-300">{r.ramp_rate_mw_min.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right text-gray-300">{r.negative_price_hours_yr.toFixed(0)}</td>
              <td className="py-2 text-right text-red-400 font-semibold">${r.estimated_loss_m_yr.toFixed(1)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Market Design Options Table
// ---------------------------------------------------------------------------

function MarketDesignTable({ data }: { data: NPEMarketDesignRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase">
            <th className="py-2 pr-4">Mechanism</th>
            <th className="py-2 pr-4">Description</th>
            <th className="py-2 pr-4 text-right">Neg. Price Reduction</th>
            <th className="py-2 pr-4 text-right">Impl. Cost ($M)</th>
            <th className="py-2 pr-4 text-center">AEMO Rec.</th>
            <th className="py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.mechanism} className="border-b border-gray-700/50 hover:bg-gray-700/30">
              <td className="py-2 pr-4 font-medium text-white text-xs">{r.mechanism.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-4 text-gray-400 text-xs max-w-xs">{r.description}</td>
              <td className="py-2 pr-4 text-right">
                <span className="text-amber-400 font-semibold">{r.estimated_negative_price_reduction_pct.toFixed(0)}%</span>
              </td>
              <td className="py-2 pr-4 text-right text-gray-300">${r.implementation_cost_m.toLocaleString()}M</td>
              <td className="py-2 pr-4 text-center">
                {r.aemo_recommendation ? (
                  <span className="text-green-400 font-semibold">Yes</span>
                ) : (
                  <span className="text-gray-500">No</span>
                )}
              </td>
              <td className="py-2 text-center">
                <Badge label={r.status} colorClass={STATUS_BADGE[r.status] ?? 'bg-gray-700 text-white'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Frequency Summary Table (top-level per region 2024)
// ---------------------------------------------------------------------------

function FrequencySummaryTable({ data }: { data: NPEFrequencyRecord[] }) {
  const rows2024 = data.filter((d) => d.year === 2024).sort((a, b) => b.negative_price_intervals - a.negative_price_intervals)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase">
            <th className="py-2 pr-4">Region</th>
            <th className="py-2 pr-4 text-right">Intervals (2024)</th>
            <th className="py-2 pr-4 text-right">Hours</th>
            <th className="py-2 pr-4 text-right">% of Year</th>
            <th className="py-2 pr-4 text-right">Avg Price ($/MWh)</th>
            <th className="py-2 pr-4 text-right">Deepest ($/MWh)</th>
            <th className="py-2 text-right">Max Consec. Hrs</th>
          </tr>
        </thead>
        <tbody>
          {rows2024.map((r) => (
            <tr key={r.region} className="border-b border-gray-700/50 hover:bg-gray-700/30">
              <td className="py-2 pr-4">
                <span style={{ color: REGION_COLOUR[r.region] ?? '#9CA3AF' }} className="font-bold">
                  {r.region}
                </span>
              </td>
              <td className="py-2 pr-4 text-right text-white font-semibold">{r.negative_price_intervals.toLocaleString()}</td>
              <td className="py-2 pr-4 text-right text-gray-300">{r.negative_price_hours.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right">
                <span className={r.pct_of_year >= 15 ? 'text-red-400 font-semibold' : 'text-amber-400'}>
                  {r.pct_of_year.toFixed(2)}%
                </span>
              </td>
              <td className="py-2 pr-4 text-right text-red-400">${r.avg_negative_price.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right text-red-500 font-semibold">${r.deepest_price.toFixed(0)}</td>
              <td className="py-2 text-right text-gray-300">{r.consecutive_negative_hrs_max.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

const DRIVER_REGIONS = ['SA1', 'VIC1', 'NSW1', 'QLD1', 'TAS1']

export default function NegativePriceEventAnalytics() {
  const [data, setData]       = useState<NPEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [driverRegion, setDriverRegion] = useState<string>('SA1')

  const load = () => {
    setLoading(true)
    setError(null)
    getNegativePriceEventsDashboard()
      .then(setData)
      .catch((e) => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw size={24} className="animate-spin mr-3" />
        Loading NEM Negative Price Event Analytics…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle size={24} className="mr-3" />
        {error ?? 'Unknown error'}
      </div>
    )
  }

  const s = data.summary as Record<string, number | string>

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingDown size={28} className="text-amber-400" />
          <div>
            <h1 className="text-xl font-bold text-white">NEM Negative Price Event Analytics</h1>
            <p className="text-xs text-gray-400">
              Economics and frequency of negative electricity prices · drivers · market design implications
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Total Neg. Intervals 2024"
          value={Number(s.total_negative_intervals_2024).toLocaleString()}
          sub="5-min intervals NEM-wide"
          icon={TrendingDown}
          accent="border-red-500"
        />
        <KpiCard
          label="SA1 % of Year"
          value={`${s.pct_of_year_sa1}%`}
          sub="Most impacted region"
          icon={Zap}
          accent="border-amber-500"
        />
        <KpiCard
          label="Avg Negative Price 2024"
          value={`$${s.avg_negative_price_2024}/MWh`}
          sub="During negative periods"
          icon={DollarSign}
          accent="border-orange-500"
        />
        <KpiCard
          label="Battery Arbitrage Value"
          value={`$${s.battery_arbitrage_value_m}M`}
          sub="Estimated NEM-wide 2024"
          icon={Battery}
          accent="border-green-500"
        />
        <KpiCard
          label="Deepest Price"
          value={`$${s.deepest_price}/MWh`}
          sub="Market floor"
          icon={AlertTriangle}
          accent="border-red-700"
        />
        <KpiCard
          label="YoY Increase"
          value={`+${s.yoy_increase_pct}%`}
          sub="Negative interval growth"
          icon={Wind}
          accent="border-violet-500"
        />
      </div>

      {/* Frequency Trends */}
      <Section title="Negative Price Interval Frequency by Region (2018–2024)">
        <FrequencyTrendsChart data={data.frequency} />
      </Section>

      {/* Frequency Summary Table */}
      <Section title="2024 Regional Summary — Negative Price Events">
        <FrequencySummaryTable data={data.frequency} />
      </Section>

      {/* Drivers Breakdown */}
      <Section title="Negative Price Drivers — Stacked Breakdown by Quarter">
        <div className="flex gap-2 mb-4 flex-wrap">
          {DRIVER_REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setDriverRegion(r)}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                driverRegion === r
                  ? 'text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              style={driverRegion === r ? { backgroundColor: REGION_COLOUR[r] } : {}}
            >
              {r}
            </button>
          ))}
        </div>
        <DriversBreakdownChart data={data.drivers} region={driverRegion} />
        <p className="text-xs text-gray-500 mt-2">
          Breakdown shows the primary driver contribution (%) to negative price intervals for {driverRegion}.
          Rooftop solar dominates in SA1 and VIC1; wind and must-run baseload contribute across all regions.
        </p>
      </Section>

      {/* Battery Opportunity */}
      <Section title="Battery Storage Charging Opportunity (Negative Price Windows)">
        <BatteryOpportunityChart data={data.battery_opportunity} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase">
                <th className="py-2 pr-4">Region</th>
                <th className="py-2 pr-4">Year</th>
                <th className="py-2 pr-4 text-right">Neg. Price MWh Avail.</th>
                <th className="py-2 pr-4 text-right">Charge Value ($M)</th>
                <th className="py-2 pr-4 text-right">Battery Needed (MW)</th>
                <th className="py-2 pr-4 text-right">Avg Charge Price</th>
                <th className="py-2 text-right">Arb. Spread ($/MWh)</th>
              </tr>
            </thead>
            <tbody>
              {data.battery_opportunity.map((r) => (
                <tr key={`${r.region}-${r.year}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-4">
                    <span style={{ color: REGION_COLOUR[r.region] ?? '#9CA3AF' }} className="font-semibold">
                      {r.region}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{r.year}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{r.negative_price_mwh_available.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-green-400 font-semibold">${r.optimal_charge_value_m.toFixed(1)}M</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{r.battery_capacity_mw_needed.toFixed(0)} MW</td>
                  <td className="py-2 pr-4 text-right text-red-400">${r.avg_charge_price.toFixed(1)}/MWh</td>
                  <td className="py-2 text-right text-amber-400">${r.arbitrage_spread_to_peak.toFixed(0)}/MWh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Must-Run Plant Impact */}
      <Section title="Must-Run Plant Impact — Financial Losses During Negative Price Periods">
        <MustRunTable data={data.must_run} />
        <p className="text-xs text-gray-500 mt-3">
          Coal and gas units with high minimum stable loads cannot economically shut down during
          short negative price events. Losses represent estimated revenue foregone at average
          negative prices during hours the unit was dispatched.
        </p>
      </Section>

      {/* Market Design Options */}
      <Section title="Market Design Options — Addressing Structural Negative Prices">
        <MarketDesignTable data={data.market_design} />
        <p className="text-xs text-gray-500 mt-3">
          AEMO and market bodies have proposed and implemented multiple mechanisms to address the
          growing frequency of negative price events. Implemented measures (5-min settlement, storage
          incentives, pumped-hydro optimisation) are showing early impact; further interconnector
          upgrades and demand flexibility programs are under active consideration.
        </p>
      </Section>

      {/* Insight Panel */}
      <section className="bg-gray-800 rounded-lg p-5 border border-amber-700/40">
        <div className="flex items-center gap-2 mb-3">
          <Sun size={16} className="text-amber-400" />
          <h2 className="text-base font-semibold text-white">Key Insights</h2>
        </div>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>
            <span className="text-amber-400 font-semibold">SA1</span> leads the NEM with{' '}
            <span className="text-white font-semibold">{s.pct_of_year_sa1}%</span> of 2024 dispatch
            intervals at negative prices, driven by world-leading rooftop solar penetration exceeding
            capacity at midday.
          </li>
          <li>
            NEM-wide negative price intervals have grown{' '}
            <span className="text-red-400 font-semibold">+{s.yoy_increase_pct}%</span> year-on-year
            as renewable capacity outpaces storage and demand flexibility.
          </li>
          <li>
            Grid-scale batteries can capture an estimated{' '}
            <span className="text-green-400 font-semibold">${s.battery_arbitrage_value_m}M</span>{' '}
            per year NEM-wide through charging at negative prices and discharging into evening peaks.
          </li>
          <li>
            The <span className="text-white font-semibold">5-minute settlement</span> reform
            (implemented 2021) has reduced manipulation of negative price windows by 12%, but
            structural oversupply from must-run coal and growing VRE remains the dominant driver.
          </li>
          <li>
            The market price floor of{' '}
            <span className="text-red-500 font-semibold">${s.deepest_price}/MWh</span> creates a
            perverse incentive for some generators to offer negative prices to avoid shut-down costs,
            a mechanism under AEMC review.
          </li>
        </ul>
      </section>
    </div>
  )
}
