import { useEffect, useState } from 'react'
import { Sliders } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  EDFMDashboard,
  EDFMActivationEventRecord,
  getDemandFlexibilityMarketDashboard,
} from '../api/client'

// ---- Colour palette ----
const SCENARIO_COLORS: Record<string, string> = {
  'Base':             '#6b7280',
  'High DER':         '#3b82f6',
  'High Industrial':  '#f97316',
  'Policy Push':      '#10b981',
}
const TRIGGER_COLORS: Record<string, string> = {
  'Price Spike':        '#ef4444',
  'Reliability':        '#f59e0b',
  'Network Constraint': '#3b82f6',
  'Frequency':          '#a855f7',
  'Test':               '#6b7280',
}
const SECTOR_COLORS: Record<string, string> = {
  'Residential': '#3b82f6',
  'Commercial':  '#f59e0b',
  'Industrial':  '#10b981',
}

// ---- Helpers ----
function enrolledVsActivatedByType(providers: EDFMDashboard['providers']) {
  const map: Record<string, { enrolled: number; activated: number }> = {}
  for (const p of providers) {
    if (!map[p.provider_type]) map[p.provider_type] = { enrolled: 0, activated: 0 }
    map[p.provider_type].enrolled += p.enrolled_capacity_mw
    map[p.provider_type].activated += p.activated_capacity_mw
  }
  return Object.entries(map).map(([provider_type, v]) => ({
    provider_type,
    enrolled: Math.round(v.enrolled),
    activated: Math.round(v.activated),
  }))
}

function forecastByScenario(forecasts: EDFMDashboard['forecasts']) {
  const byYear: Record<number, Record<string, number>> = {}
  for (const f of forecasts) {
    if (!byYear[f.year]) byYear[f.year] = { year: f.year }
    byYear[f.year][f.scenario] = f.total_flex_capacity_gw
  }
  return Object.values(byYear).sort((a, b) => a.year - b.year)
}

function activationsByTrigger(events: EDFMActivationEventRecord[]) {
  const map: Record<string, number> = {}
  for (const e of events) {
    map[e.trigger_type] = (map[e.trigger_type] ?? 0) + 1
  }
  return Object.entries(map).map(([trigger_type, count]) => ({ trigger_type, count }))
}

function flexPotentialBySector(segments: EDFMDashboard['customer_segments']) {
  const map: Record<string, number> = {}
  for (const s of segments) {
    const total = Math.round((s.flex_potential_kw_per_site * s.num_sites) / 1000)
    map[s.sector] = (map[s.sector] ?? 0) + total
  }
  return Object.entries(map).map(([sector, flex_mw]) => ({ sector, flex_mw }))
}

function kpiCard(title: string, value: string, sub: string, color: string) {
  return (
    <div key={title} className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{title}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  )
}

function triggerBadge(trigger: string) {
  const cls: Record<string, string> = {
    'Price Spike':        'bg-red-900 text-red-300',
    'Reliability':        'bg-amber-900 text-amber-300',
    'Network Constraint': 'bg-blue-900 text-blue-300',
    'Frequency':          'bg-purple-900 text-purple-300',
    'Test':               'bg-gray-700 text-gray-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls[trigger] ?? 'bg-gray-700 text-gray-300'}`}>
      {trigger}
    </span>
  )
}

export default function DemandFlexibilityMarketAnalytics() {
  const [data, setData] = useState<EDFMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDemandFlexibilityMarketDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        <div className="text-center">
          <Sliders size={40} className="mx-auto mb-3 text-emerald-400 animate-pulse" />
          <p className="text-sm">Loading Demand Flexibility Market data…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        <div className="text-center">
          <Sliders size={40} className="mx-auto mb-3" />
          <p className="text-sm">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const { providers, activation_events, market_products, customer_segments, forecasts, network_benefits, summary } = data

  const providerTypeData = enrolledVsActivatedByType(providers)
  const forecastData = forecastByScenario(forecasts)
  const triggerData = activationsByTrigger(activation_events)
  const sectorFlex = flexPotentialBySector(customer_segments)
  const top10Events = [...activation_events].sort((a, b) => b.delivered_mw - a.delivered_mw).slice(0, 10)

  return (
    <div className="min-h-full bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Sliders size={28} className="text-emerald-400" />
        <div>
          <h1 className="text-xl font-bold">Electricity Demand Flexibility Market Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">NEM demand flexibility programs · Provider performance · Market products · Forecasts</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiCard('Enrolled Capacity', `${summary.total_enrolled_mw?.toLocaleString()} MW`, 'Total flexibility enrolled', 'text-emerald-400')}
        {kpiCard('Activation Events', `${summary.total_activation_events}`, '2022–2024 recorded events', 'text-blue-400')}
        {kpiCard('Avg Delivery Rate', `${summary.avg_delivery_rate_pct?.toFixed(1)}%`, 'Delivered vs requested MW', 'text-amber-400')}
        {kpiCard('Network Benefits', `$${summary.total_network_benefit_m?.toFixed(1)}M`, 'Annual network benefit (p.a.)', 'text-purple-400')}
      </div>

      {/* Row 1: Provider chart + Forecast chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Enrolled vs Activated by Provider Type */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Enrolled vs Activated Capacity by Provider Type (MW)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={providerTypeData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="provider_type" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="enrolled" name="Enrolled MW" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="activated" name="Activated MW" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Forecast Flexibility Capacity by Scenario */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Forecast Flexibility Capacity by Scenario 2025–2029 (GW)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={forecastData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {Object.keys(SCENARIO_COLORS).map(sc => (
                <Line key={sc} type="monotone" dataKey={sc} stroke={SCENARIO_COLORS[sc]} strokeWidth={2} dot={{ r: 4 }} name={sc} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Trigger Type bar + Sector flex potential bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Activations by Trigger Type */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Activation Events by Trigger Type (Count)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={triggerData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="trigger_type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} />
              <Bar dataKey="count" name="Events" radius={[4, 4, 0, 0]}>
                {triggerData.map(entry => (
                  <rect key={entry.trigger_type} fill={TRIGGER_COLORS[entry.trigger_type] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Segment Flex Potential by Sector */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Customer Segment Flex Potential by Sector (MW)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sectorFlex} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} formatter={(v: number) => [`${v.toLocaleString()} MW`, 'Flex Potential']} />
              <Bar dataKey="flex_mw" name="Flex Potential MW" radius={[4, 4, 0, 0]}>
                {sectorFlex.map(entry => (
                  <rect key={entry.sector} fill={SECTOR_COLORS[entry.sector] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Top 10 Activation Events Table */}
      <div className="bg-gray-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Top 10 Activation Events by Delivered MW</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-2 pr-4">Event ID</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Trigger Type</th>
                <th className="py-2 pr-4">Region</th>
                <th className="py-2 pr-4 text-right">Requested MW</th>
                <th className="py-2 pr-4 text-right">Delivered MW</th>
                <th className="py-2 pr-4 text-right">Delivery %</th>
                <th className="py-2 pr-4 text-right">Duration (min)</th>
                <th className="py-2 text-right">Spot Price ($/MWh)</th>
              </tr>
            </thead>
            <tbody>
              {top10Events.map(e => (
                <tr key={e.event_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-mono text-gray-300">{e.event_id}</td>
                  <td className="py-2 pr-4 text-gray-400">{e.event_date}</td>
                  <td className="py-2 pr-4">{triggerBadge(e.trigger_type)}</td>
                  <td className="py-2 pr-4 text-gray-300">{e.region}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{e.requested_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-emerald-400">{e.delivered_mw.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-amber-400">{e.delivery_rate_pct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{e.duration_mins}</td>
                  <td className="py-2 text-right text-red-400">${e.spot_price_dolpermwh.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Market Products Table */}
      <div className="bg-gray-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Market Products</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Market Type</th>
                <th className="py-2 pr-4">Gate Closure (min)</th>
                <th className="py-2 pr-4 text-right">Min Duration</th>
                <th className="py-2 pr-4 text-right">Max Duration</th>
                <th className="py-2 pr-4">Payment Mechanism</th>
                <th className="py-2 pr-4 text-right">Min Response (MW)</th>
                <th className="py-2 text-right">Avg Clearing ($/MWh)</th>
              </tr>
            </thead>
            <tbody>
              {market_products.map(mp => (
                <tr key={mp.product_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-medium text-gray-200">{mp.product_name}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 rounded bg-blue-900 text-blue-300 text-xs">{mp.market_type}</span>
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{mp.gate_closure_min_before.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{mp.min_duration_mins} min</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{mp.max_duration_mins} min</td>
                  <td className="py-2 pr-4 text-gray-300">{mp.payment_mechanism}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{mp.min_response_mw}</td>
                  <td className="py-2 text-right font-semibold text-amber-400">${mp.avg_clearing_price_dolpermwh.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 5: Network Benefits summary */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Network Benefits Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-2 pr-4">Network Area</th>
                <th className="py-2 pr-4">Benefit Type</th>
                <th className="py-2 pr-4 text-right">Annual Benefit ($M)</th>
                <th className="py-2 pr-4 text-right">Deferred Capex ($M)</th>
                <th className="py-2 pr-4 text-right">Flex Contribution (MW)</th>
                <th className="py-2 text-right">Years Deferred</th>
              </tr>
            </thead>
            <tbody>
              {network_benefits.map(nb => (
                <tr key={nb.benefit_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 text-gray-200">{nb.network_area}</td>
                  <td className="py-2 pr-4 text-gray-400">{nb.benefit_type}</td>
                  <td className="py-2 pr-4 text-right text-emerald-400">${nb.annual_benefit_m.toFixed(1)}M</td>
                  <td className="py-2 pr-4 text-right text-purple-400">${nb.deferred_capex_m.toFixed(1)}M</td>
                  <td className="py-2 pr-4 text-right text-blue-400">{nb.flex_contribution_mw.toFixed(1)}</td>
                  <td className="py-2 text-right text-amber-400">{nb.years_deferred}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
