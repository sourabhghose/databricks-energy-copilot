import { useEffect, useState } from 'react'
import { Sliders } from 'lucide-react'
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { getNTRDashboard, NTRDashboard } from '../api/client'

const TARIFF_TYPE_COLORS: Record<string, string> = {
  FLAT: '#6b7280',
  TOU: '#3b82f6',
  DEMAND: '#f59e0b',
  DYNAMIC_NETWORK: '#10b981',
}

const TARIFF_CLASS_COLORS: Record<string, string> = {
  RESIDENTIAL: '#3b82f6',
  SME: '#f59e0b',
  LARGE_COMMERCIAL: '#8b5cf6',
  INDUSTRIAL: '#ef4444',
}

const INCENTIVE_TYPE_COLORS: Record<string, string> = {
  SOLAR_FIT: '#f59e0b',
  BATTERY_REBATE: '#3b82f6',
  EV_SMART_CHARGING: '#10b981',
  VPP_PARTICIPATION: '#8b5cf6',
  DEMAND_RESPONSE: '#ef4444',
  SOLAR_SPONGE: '#06b6d4',
}

const CUSTOMER_TYPE_COLORS: Record<string, string> = {
  AVERAGE: '#6b7280',
  HIGH_SOLAR: '#f59e0b',
  EV_OWNER: '#10b981',
  BATTERY_OWNER: '#3b82f6',
  HIGH_DEMAND: '#ef4444',
}

function TariffTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    FLAT: 'bg-gray-700 text-gray-200',
    TOU: 'bg-blue-900 text-blue-200',
    DEMAND: 'bg-amber-900 text-amber-200',
    DYNAMIC_NETWORK: 'bg-emerald-900 text-emerald-200',
  }
  const labels: Record<string, string> = {
    FLAT: 'Flat',
    TOU: 'TOU',
    DEMAND: 'Demand',
    DYNAMIC_NETWORK: 'Dynamic',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colors[type] ?? 'bg-gray-700 text-gray-300'}`}>
      {labels[type] ?? type}
    </span>
  )
}

function TariffClassBadge({ cls }: { cls: string }) {
  const colors: Record<string, string> = {
    RESIDENTIAL: 'bg-blue-900 text-blue-200',
    SME: 'bg-amber-900 text-amber-200',
    LARGE_COMMERCIAL: 'bg-purple-900 text-purple-200',
    INDUSTRIAL: 'bg-red-900 text-red-200',
  }
  const labels: Record<string, string> = {
    RESIDENTIAL: 'Residential',
    SME: 'SME',
    LARGE_COMMERCIAL: 'Large Comm.',
    INDUSTRIAL: 'Industrial',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colors[cls] ?? 'bg-gray-700 text-gray-300'}`}>
      {labels[cls] ?? cls}
    </span>
  )
}

function BoolBadge({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${value ? 'bg-emerald-900 text-emerald-200' : 'bg-red-900 text-red-200'}`}>
      {value ? trueLabel : falseLabel}
    </span>
  )
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—'
  return n.toFixed(decimals)
}

interface BillImpactDatum {
  label: string
  before: number
  after: number
}

function buildBillImpactData(impacts: NTRDashboard['tariff_impacts'], selectedTariff: string): BillImpactDatum[] {
  return impacts
    .filter(r => r.tariff_type === selectedTariff)
    .map(r => ({
      label: r.customer_type.replace('_', ' '),
      before: r.annual_bill_before_aud,
      after: r.annual_bill_after_aud,
    }))
}

interface ScatterDatum {
  x: number
  y: number
  z: number
  name: string
  type: string
}

export default function NetworkTariffReformAnalytics() {
  const [data, setData] = useState<NTRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTariff, setSelectedTariff] = useState<string>('TOU')

  useEffect(() => {
    getNTRDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Network Tariff Reform analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Failed to load data: {error}
      </div>
    )
  }

  // KPI calculations
  const tariffTypesInMarket = new Set(data.tariff_structures.map(r => r.tariff_type)).size
  const highestPeakReduction = Math.max(...data.reform_outcomes.map(r => r.peak_demand_reduction_mw))
  const totalDerIncentiveSpending = data.der_incentives.reduce(
    (sum, r) => sum + r.incentive_value_aud * r.eligible_customers_k * (r.uptake_rate_pct / 100),
    0
  ) / 1000 // in M AUD
  const highestSolarExportRate = Math.max(
    ...data.tariff_structures
      .filter(r => r.solar_export_rate_aud_kwh != null)
      .map(r => r.solar_export_rate_aud_kwh!)
  )

  // Bill impact chart data
  const billImpactData = buildBillImpactData(data.tariff_impacts, selectedTariff)

  // Scatter data for DER incentives
  const scatterData: ScatterDatum[] = data.der_incentives.map(r => ({
    x: r.uptake_rate_pct,
    y: r.annual_network_benefit_m_aud,
    z: r.eligible_customers_k,
    name: `${r.dnsp} – ${r.incentive_type.replace('_', ' ')}`,
    type: r.incentive_type,
  }))

  const tariffTypes = ['FLAT', 'TOU', 'DEMAND', 'DYNAMIC_NETWORK']

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sliders className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Network Tariff Reform & DER Incentive Analytics</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Cost-reflective tariff structures, demand tariffs, time-of-use pricing, and DER investment incentives
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Tariff Types in Market</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{tariffTypesInMarket}</p>
          <p className="text-gray-500 text-xs mt-1">Flat / TOU / Demand / Dynamic</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Highest Peak Demand Reduction</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{highestPeakReduction.toFixed(0)} <span className="text-lg font-normal">MW</span></p>
          <p className="text-gray-500 text-xs mt-1">Best reform outcome</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Total DER Incentive Spending</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">${totalDerIncentiveSpending.toFixed(1)} <span className="text-lg font-normal">M AUD</span></p>
          <p className="text-gray-500 text-xs mt-1">Estimated uptake-weighted spend</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Highest Solar Export Rate</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">${highestSolarExportRate.toFixed(3)} <span className="text-lg font-normal">AUD/kWh</span></p>
          <p className="text-gray-500 text-xs mt-1">Best FiT available</p>
        </div>
      </div>

      {/* Tariff Structure Comparison Table */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Tariff Structure Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-left">
                <th className="pb-2 pr-3">DNSP</th>
                <th className="pb-2 pr-3">Class</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3 text-right">Daily Supply</th>
                <th className="pb-2 pr-3 text-right">Flat Rate</th>
                <th className="pb-2 pr-3 text-right">Peak Rate</th>
                <th className="pb-2 pr-3 text-right">Off-peak Rate</th>
                <th className="pb-2 pr-3 text-right">Demand Charge</th>
                <th className="pb-2 pr-3 text-right">Solar Export</th>
                <th className="pb-2 text-right">Customers (k)</th>
              </tr>
            </thead>
            <tbody>
              {data.tariff_structures.map((r, i) => (
                <tr key={i} className={`border-b border-gray-800 hover:bg-gray-800 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-900/50'}`}>
                  <td className="py-2 pr-3 font-medium text-white">{r.dnsp}</td>
                  <td className="py-2 pr-3"><TariffClassBadge cls={r.tariff_class} /></td>
                  <td className="py-2 pr-3"><TariffTypeBadge type={r.tariff_type} /></td>
                  <td className="py-2 pr-3 text-right text-gray-300">${fmt(r.daily_supply_aud, 2)}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{r.flat_rate_aud_kwh != null ? `${(r.flat_rate_aud_kwh * 100).toFixed(1)}c` : '—'}</td>
                  <td className="py-2 pr-3 text-right text-red-300">{r.peak_rate_aud_kwh != null ? `${(r.peak_rate_aud_kwh * 100).toFixed(1)}c` : '—'}</td>
                  <td className="py-2 pr-3 text-right text-blue-300">{r.offpeak_rate_aud_kwh != null ? `${(r.offpeak_rate_aud_kwh * 100).toFixed(1)}c` : '—'}</td>
                  <td className="py-2 pr-3 text-right text-amber-300">{r.demand_rate_aud_kw_month != null ? `$${fmt(r.demand_rate_aud_kw_month, 2)}/kW` : '—'}</td>
                  <td className="py-2 pr-3 text-right text-emerald-300">{r.solar_export_rate_aud_kwh != null ? `${(r.solar_export_rate_aud_kwh * 100).toFixed(1)}c` : '—'}</td>
                  <td className="py-2 text-right text-gray-300">{r.customers_k.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Impact Grouped Bar Chart */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Annual Bill Impact by Customer Type</h2>
          <div className="flex gap-2">
            {tariffTypes.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTariff(t)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  selectedTariff === t
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                style={{ backgroundColor: selectedTariff === t ? TARIFF_TYPE_COLORS[t] : undefined, border: `1px solid ${TARIFF_TYPE_COLORS[t]}` }}
              >
                {t === 'DYNAMIC_NETWORK' ? 'Dynamic' : t === 'TOU' ? 'TOU' : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={billImpactData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={v => `$${v.toLocaleString()}`}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(val: number) => [`$${val.toLocaleString()}`, '']}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            <Bar dataKey="before" name="Before Reform" fill="#6b7280" radius={[3, 3, 0, 0]} />
            <Bar dataKey="after" name="After Reform" fill={TARIFF_TYPE_COLORS[selectedTariff]} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-gray-500 text-xs mt-2">
          Showing bill impact for <span className="font-semibold text-gray-300">{selectedTariff}</span> tariff. Bars show annual bill before and after reform for each customer type.
        </p>
      </div>

      {/* DER Incentive Effectiveness Scatter */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-1">DER Incentive Effectiveness</h2>
        <p className="text-gray-400 text-xs mb-4">Uptake rate (%) vs. annual network benefit (M AUD), bubble size = eligible customers (k). Colour = incentive type.</p>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="x"
              name="Uptake Rate"
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Uptake Rate (%)', position: 'insideBottom', offset: -10, fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis
              dataKey="y"
              name="Network Benefit"
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              label={{ value: 'Annual Network Benefit (M AUD)', angle: -90, position: 'insideLeft', offset: 10, fill: '#6b7280', fontSize: 12 }}
            />
            <ZAxis dataKey="z" range={[60, 500]} name="Eligible Customers (k)" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0].payload as ScatterDatum
                return (
                  <div className="bg-gray-800 border border-gray-600 rounded p-3 text-xs">
                    <p className="font-bold text-white mb-1">{d.name}</p>
                    <p className="text-gray-300">Uptake: <span className="text-amber-300">{d.x.toFixed(1)}%</span></p>
                    <p className="text-gray-300">Network Benefit: <span className="text-emerald-300">${d.y.toFixed(1)}M AUD</span></p>
                    <p className="text-gray-300">Eligible Customers: <span className="text-blue-300">{d.z}k</span></p>
                  </div>
                )
              }}
            />
            <Scatter data={scatterData} name="DER Incentives">
              {scatterData.map((entry, i) => (
                <Cell key={i} fill={INCENTIVE_TYPE_COLORS[entry.type] ?? '#6b7280'} fillOpacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(INCENTIVE_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-gray-400 text-xs">{type.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reform Outcomes Table */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Reform Outcomes Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-left">
                <th className="pb-2 pr-3">DNSP</th>
                <th className="pb-2 pr-3">Reform Name</th>
                <th className="pb-2 pr-3 text-center">Year</th>
                <th className="pb-2 pr-3 text-right">Customers (k)</th>
                <th className="pb-2 pr-3 text-right">Peak Reduction (MW)</th>
                <th className="pb-2 pr-3 text-center">Revenue Neutral</th>
                <th className="pb-2 pr-3 text-right">Avg Consumer Saving</th>
                <th className="pb-2 text-center">AER Approved</th>
              </tr>
            </thead>
            <tbody>
              {data.reform_outcomes.map((r, i) => (
                <tr key={i} className={`border-b border-gray-800 hover:bg-gray-800 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-900/50'}`}>
                  <td className="py-2.5 pr-3 font-medium text-white">{r.dnsp}</td>
                  <td className="py-2.5 pr-3 text-gray-300">{r.reform_name}</td>
                  <td className="py-2.5 pr-3 text-center text-gray-300">{r.implementation_year}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-300">{r.customers_affected_k.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-right">
                    <span className={r.peak_demand_reduction_mw >= 100 ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
                      {r.peak_demand_reduction_mw.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-center"><BoolBadge value={r.revenue_neutral} /></td>
                  <td className="py-2.5 pr-3 text-right">
                    <span className={r.consumer_avg_saving_aud >= 200 ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>
                      ${r.consumer_avg_saving_aud.toFixed(0)}
                    </span>
                  </td>
                  <td className="py-2.5 text-center"><BoolBadge value={r.aer_approved} trueLabel="Approved" falseLabel="Pending" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <p className="text-gray-600 text-xs text-right">
        Data as at {new Date(data.timestamp).toLocaleString()} UTC — Network Tariff Reform & DER Incentive Analytics
      </p>
    </div>
  )
}
