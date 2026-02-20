import { useEffect, useState, useMemo } from 'react'
import { Flame } from 'lucide-react'
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
  getGasElectricityNexusDashboard,
  NGMDashboard,
  NGMGasPriceRecord,
  NGMGasPowerRecord,
  NGMSupplyRecord,
  NGMStorageRecord,
  NGMNexusRecord,
} from '../api/client'

// ── Colour maps ───────────────────────────────────────────────────────────────

const HUB_COLORS: Record<string, string> = {
  WALLUMBILLA: '#f59e0b',
  MOOMBA:      '#10b981',
  LONGFORD:    '#3b82f6',
  DAMPIER:     '#a855f7',
  VIC_GMH:     '#ef4444',
  ADELAIDE:    '#06b6d4',
  QUEENSLAND:  '#f97316',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#3b82f6',
  VIC1: '#10b981',
  QLD1: '#f59e0b',
  SA1:  '#ef4444',
  TAS1: '#a855f7',
}

const STORAGE_TYPE_BADGE: Record<string, string> = {
  DEPLETED_RESERVOIR: 'bg-blue-700 text-blue-100',
  SALT_CAVERN:        'bg-purple-700 text-purple-100',
  LNG_PEAKSHAVER:     'bg-amber-700 text-amber-100',
  LINEPACK:           'bg-emerald-700 text-emerald-100',
}

const HUBS = [
  'WALLUMBILLA', 'MOOMBA', 'LONGFORD', 'DAMPIER',
  'VIC_GMH', 'ADELAIDE', 'QUEENSLAND',
]
const REGIONS = ['NSW1', 'VIC1', 'QLD1', 'SA1', 'TAS1']

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <h2 className="text-base font-semibold text-gray-200 mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GasElectricityNexusAnalytics() {
  const [data, setData] = useState<NGMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedHub, setSelectedHub] = useState('WALLUMBILLA')
  const [selectedRegion, setSelectedRegion] = useState('SA1')

  useEffect(() => {
    getGasElectricityNexusDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  // Gas hub prices — pivot by month for LineChart (all hubs)
  const gasPriceChartData = useMemo(() => {
    if (!data) return []
    const byMonth: Record<string, Record<string, number>> = {}
    data.gas_prices.forEach((r: NGMGasPriceRecord) => {
      if (!byMonth[r.month]) byMonth[r.month] = { month: r.month as unknown as number }
      byMonth[r.month][r.hub] = r.spot_price_per_gj
    })
    return Object.values(byMonth).sort((a, b) =>
      String(a.month).localeCompare(String(b.month))
    )
  }, [data])

  // Single hub trend (spot vs contract vs LNG netback)
  const hubTrendData = useMemo(() => {
    if (!data) return []
    return data.gas_prices
      .filter((r: NGMGasPriceRecord) => r.hub === selectedHub)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(r => ({
        month: r.month.slice(5),
        spot: r.spot_price_per_gj,
        contract: r.contract_price_per_gj,
        lng_netback: r.lng_netback_per_gj,
        premium: r.domestic_premium_pct,
      }))
  }, [data, selectedHub])

  // Gas-power chart — bar chart by region/quarter
  const gasPowerChartData = useMemo(() => {
    if (!data) return []
    return data.gas_power.map((r: NGMGasPowerRecord) => ({
      label: `${r.region} ${r.quarter}`,
      region: r.region,
      quarter: r.quarter,
      gas_pct: r.gas_generation_pct,
      spread: r.gas_to_power_spread,
      elec_price: r.avg_electricity_price,
      gas_price: r.avg_gas_price_per_gj,
    }))
  }, [data])

  // Gas-power by region (Q avg)
  const gasPowerByRegion = useMemo(() => {
    if (!data) return []
    const agg: Record<string, { gas_pct: number[]; spread: number[] }> = {}
    data.gas_power.forEach((r: NGMGasPowerRecord) => {
      if (!agg[r.region]) agg[r.region] = { gas_pct: [], spread: [] }
      agg[r.region].gas_pct.push(r.gas_generation_pct)
      agg[r.region].spread.push(r.gas_to_power_spread)
    })
    return Object.entries(agg).map(([region, v]) => ({
      region,
      avg_gas_pct: +(v.gas_pct.reduce((a, b) => a + b, 0) / v.gas_pct.length).toFixed(1),
      avg_spread: +(v.spread.reduce((a, b) => a + b, 0) / v.spread.length).toFixed(1),
    }))
  }, [data])

  // Nexus correlation for selected region
  const nexusChartData = useMemo(() => {
    if (!data) return []
    return data.nexus
      .filter((r: NGMNexusRecord) => r.region === selectedRegion)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(r => ({
        month: r.month.slice(5),
        shock: r.gas_price_shock_per_gj,
        response: r.electricity_price_response,
        pass_through: +(r.pass_through_elasticity * 100).toFixed(1),
      }))
  }, [data, selectedRegion])

  // Summary values
  const summary = data?.summary ?? {}

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400">
        Loading Gas-Electricity Nexus data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-red-400">
        Error loading data: {error}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen text-white">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-600 rounded-lg">
          <Flame className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Natural Gas Market Integration &amp; Electricity Nexus Analytics
          </h1>
          <p className="text-sm text-gray-400">
            Gas-electricity nexus, hub pricing, peaker economics, domestic supply security
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard
          label="Wallumbilla Spot 2024"
          value={`$${summary.avg_wallumbilla_spot_2024}/GJ`}
        />
        <KpiCard
          label="Gas Generation 2024"
          value={`${summary.gas_generation_pct_2024}%`}
          sub="of NEM generation"
        />
        <KpiCard
          label="Gas-Power Elasticity"
          value={`${summary.gas_to_power_elasticity_avg} $/MWh`}
          sub="per $1/GJ gas"
        />
        <KpiCard
          label="Domestic Supply"
          value={`${summary.total_domestic_supply_pj} PJ`}
          sub="2024 total"
        />
        <KpiCard
          label="Storage Cover"
          value={`${summary.storage_days_of_supply_avg} days`}
          sub="avg days of supply"
        />
        <KpiCard
          label="Price Shock Events"
          value={`${summary.price_shock_events_2024}`}
          sub="events in 2024"
        />
        <KpiCard
          label="Highest Corr. Region"
          value={String(summary.highest_corr_region)}
          sub="gas-electricity link"
        />
      </div>

      {/* Section 1: Gas Hub Spot Prices — all 7 hubs */}
      <Section title="Gas Hub Spot Prices — All Hubs 2024 ($/GJ)">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gasPriceChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => [`$${v}/GJ`]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {HUBS.map(hub => (
                <Line
                  key={hub}
                  type="monotone"
                  dataKey={hub}
                  stroke={HUB_COLORS[hub]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Section 2: Single Hub Detail */}
      <Section title="Hub Price Detail — Spot / Contract / LNG Netback">
        <div className="flex gap-2 mb-4 flex-wrap">
          {HUBS.map(hub => (
            <button
              key={hub}
              onClick={() => setSelectedHub(hub)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                hub === selectedHub
                  ? 'bg-orange-600 border-orange-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {hub.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hubTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}`} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v: number, name: string) => [`$${v}`, name]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Line type="monotone" dataKey="spot"       stroke="#f59e0b" strokeWidth={2} dot={false} name="Spot" />
              <Line type="monotone" dataKey="contract"   stroke="#3b82f6" strokeWidth={2} dot={false} name="Contract" />
              <Line type="monotone" dataKey="lng_netback" stroke="#10b981" strokeWidth={2} dot={false} name="LNG Netback" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Section 3: Gas-to-Power Economics */}
      <Section title="Gas-to-Power Economics — Generation % &amp; Spread by Region (Annual Avg)">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gasPowerByRegion} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar yAxisId="left"  dataKey="avg_gas_pct" name="Gas Gen %" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="right" dataKey="avg_spread"  name="Avg Spread $/MWh" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Section 4: Quarterly gas power detail table */}
      <Section title="Gas Generation by Region and Quarter">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                {['Region', 'Quarter', 'Gas Gen (TWh)', 'Gas Gen %', 'Avg Gas $/GJ',
                  'Avg Elec $/MWh', 'Spread $/MWh', 'Heat Rate', 'Cap Factor %', 'Peaker Hrs'].map(h => (
                  <th key={h} className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gasPowerChartData.map((r, i) => (
                <tr key={i} className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800/40' : ''}`}>
                  <td className="py-2 px-3 font-medium" style={{ color: REGION_COLORS[r.region] }}>{r.region}</td>
                  <td className="py-2 px-3 text-gray-300">{r.quarter}</td>
                  <td className="py-2 px-3 text-gray-200">{(data.gas_power.find(gp => gp.region === r.region && gp.quarter === r.quarter)?.gas_generation_twh ?? 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-gray-200">{r.gas_pct.toFixed(1)}%</td>
                  <td className="py-2 px-3 text-amber-400">${r.gas_price.toFixed(2)}</td>
                  <td className="py-2 px-3 text-blue-300">${r.elec_price.toFixed(2)}</td>
                  <td className={`py-2 px-3 font-semibold ${r.spread >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {r.spread >= 0 ? '+' : ''}${r.spread.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-gray-300">{(data.gas_power.find(gp => gp.region === r.region && gp.quarter === r.quarter)?.heat_rate_gj_per_mwh ?? 0).toFixed(2)} GJ/MWh</td>
                  <td className="py-2 px-3 text-gray-300">{(data.gas_power.find(gp => gp.region === r.region && gp.quarter === r.quarter)?.capacity_factor_pct ?? 0).toFixed(1)}%</td>
                  <td className="py-2 px-3 text-gray-300">{(data.gas_power.find(gp => gp.region === r.region && gp.quarter === r.quarter)?.peaker_running_hrs ?? 0).toFixed(0)} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section 5: Supply Basin Overview */}
      <Section title="Domestic Gas Supply Basin Overview">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                {['Basin', 'Year', 'Production (PJ)', '2P Reserves (PJ)', 'Reserve Life (yrs)',
                  'Domestic %', 'Export %', 'New Dev (PJ)', 'Decline Rate %'].map(h => (
                  <th key={h} className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.supply.map((r: NGMSupplyRecord, i: number) => (
                <tr key={i} className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800/40' : ''}`}>
                  <td className="py-2 px-3 font-semibold text-orange-400">{r.basin.replace('_', ' ')}</td>
                  <td className="py-2 px-3 text-gray-300">{r.year}</td>
                  <td className="py-2 px-3 text-gray-200">{r.production_pj.toFixed(1)}</td>
                  <td className="py-2 px-3 text-gray-200">{r.reserves_pj.toFixed(0)}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.reserve_life_years >= 8 ? 'bg-green-800 text-green-200'
                      : r.reserve_life_years >= 5 ? 'bg-yellow-700 text-yellow-100'
                      : 'bg-red-800 text-red-200'
                    }`}>
                      {r.reserve_life_years.toFixed(1)} yrs
                    </span>
                  </td>
                  <td className="py-2 px-3 text-blue-300">{r.domestic_supply_pct}%</td>
                  <td className="py-2 px-3 text-purple-300">{r.export_supply_pct}%</td>
                  <td className="py-2 px-3 text-emerald-300">{r.new_field_development_pj.toFixed(1)}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.decline_rate_pct >= 10 ? 'bg-red-800 text-red-200'
                      : r.decline_rate_pct >= 7 ? 'bg-yellow-700 text-yellow-100'
                      : 'bg-green-800 text-green-200'
                    }`}>
                      {r.decline_rate_pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section 6: Storage Facilities */}
      <Section title="Gas Storage Facilities — Days of Supply">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                {['Facility', 'State', 'Type', 'Capacity (PJ)', 'Working Gas (PJ)',
                  'Injection (TPD)', 'Withdrawal (TPD)', 'Fill %', 'Days of Supply'].map(h => (
                  <th key={h} className="py-2 px-3 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.storage.map((r: NGMStorageRecord, i: number) => (
                <tr key={i} className={`border-b border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-800/40' : ''}`}>
                  <td className="py-2 px-3 font-medium text-white">{r.facility_name}</td>
                  <td className="py-2 px-3 text-gray-300">{r.state}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STORAGE_TYPE_BADGE[r.type] ?? 'bg-gray-600 text-gray-200'}`}>
                      {r.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-200">{r.capacity_pj.toFixed(2)}</td>
                  <td className="py-2 px-3 text-gray-200">{r.working_gas_pj.toFixed(2)}</td>
                  <td className="py-2 px-3 text-emerald-300">{r.injection_rate_tpd.toFixed(0)}</td>
                  <td className="py-2 px-3 text-amber-300">{r.withdrawal_rate_tpd.toFixed(0)}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            r.current_storage_pct >= 70 ? 'bg-green-500'
                            : r.current_storage_pct >= 40 ? 'bg-yellow-500'
                            : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(r.current_storage_pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-300 text-xs w-8 text-right">{r.current_storage_pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`font-semibold ${
                      r.days_of_supply >= 25 ? 'text-green-400'
                      : r.days_of_supply >= 12 ? 'text-yellow-400'
                      : 'text-red-400'
                    }`}>
                      {r.days_of_supply.toFixed(1)} d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section 7: Gas-Electricity Correlation */}
      <Section title="Gas-Electricity Nexus — Price Shock vs Electricity Response">
        <div className="flex gap-2 mb-4 flex-wrap">
          {REGIONS.map(region => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                region === selectedRegion
                  ? 'border-transparent text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
              }`}
              style={region === selectedRegion ? { backgroundColor: REGION_COLORS[region], borderColor: REGION_COLORS[region] } : {}}
            >
              {region}
            </button>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={nexusChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="shock"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="Gas Price Shock ($/GJ)"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="response"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Electricity Response ($/MWh)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pass_through"
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                name="Pass-through %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Pass-through coefficient measures fraction of gas price shock passed through to electricity prices.
          Higher values indicate stronger gas-electricity price nexus.
        </p>
      </Section>
    </div>
  )
}
