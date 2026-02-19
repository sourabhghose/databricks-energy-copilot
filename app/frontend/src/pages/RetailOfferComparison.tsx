import { useEffect, useState } from 'react'
import { Tag, Percent, MapPin, Sun, Zap } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import { api } from '../api/client'
import type {
  RetailOfferComparisonDashboard,
  MarketOfferRecord,
  SolarFitRecord,
  TariffStructureRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Offer type badge styling
// ---------------------------------------------------------------------------

const OFFER_TYPE_STYLES: Record<string, string> = {
  FLAT_RATE: 'bg-gray-600 text-gray-100',
  TOU: 'bg-blue-700 text-blue-100',
  DEMAND: 'bg-purple-700 text-purple-100',
  FLEXIBLE: 'bg-amber-600 text-amber-100',
  EV_OPTIMISED: 'bg-green-700 text-green-100',
}

const OFFER_TYPE_LABELS: Record<string, string> = {
  FLAT_RATE: 'Flat Rate',
  TOU: 'Time-of-Use',
  DEMAND: 'Demand',
  FLEXIBLE: 'Flexible',
  EV_OPTIMISED: 'EV Optimised',
}

const FIT_TYPE_STYLES: Record<string, string> = {
  GROSS: 'bg-yellow-700 text-yellow-100',
  NET: 'bg-teal-700 text-teal-100',
  BATTERY_FEED_IN: 'bg-indigo-700 text-indigo-100',
}

function OfferTypeBadge({ type }: { type: string }) {
  const cls = OFFER_TYPE_STYLES[type] ?? 'bg-gray-600 text-gray-100'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {OFFER_TYPE_LABELS[type] ?? type}
    </span>
  )
}

function FitTypeBadge({ type }: { type: string }) {
  const cls = FIT_TYPE_STYLES[type] ?? 'bg-gray-600 text-gray-100'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string
  value: string
  icon: React.ReactNode
  accent?: string
}

function KpiCard({ label, value, icon, accent = 'text-blue-400' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-5 flex items-center gap-4 border border-gray-700">
      <div className={`${accent} shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DMO vs Market grouped bar + line chart
// ---------------------------------------------------------------------------

function DmoMarketChart({ data }: { data: RetailOfferComparisonDashboard['dmo_vs_market'] }) {
  const chartData = data.map((r) => ({
    name: `${r.state} ${r.year}`,
    'DMO Bill ($)': r.dmo_annual_bill,
    'Avg Market ($)': r.avg_market_offer_bill,
    'Cheapest ($)': r.cheapest_offer_bill,
    'On DMO (%)': r.consumers_on_dmo_pct,
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <h2 className="text-base font-semibold text-white mb-4">
        DMO Reference Bill vs Market Offers by State &amp; Year
      </h2>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 40, bottom: 4, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => `$${v}`}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            domain={[1000, 2600]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            domain={[0, 60]}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
            formatter={(value: number, name: string) =>
              name === 'On DMO (%)' ? [`${value}%`, name] : [`$${value.toFixed(0)}`, name]
            }
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="DMO Bill ($)" fill="#EF4444" radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="Avg Market ($)" fill="#3B82F6" radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="Cheapest ($)" fill="#10B981" radius={[2, 2, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="On DMO (%)"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ fill: '#F59E0B', r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Market Offers Table
// ---------------------------------------------------------------------------

const ALL_STATES = ['All', 'NSW', 'VIC', 'QLD', 'SA']
const ALL_TYPES = ['All', 'FLAT_RATE', 'TOU', 'DEMAND', 'FLEXIBLE', 'EV_OPTIMISED']

function MarketOffersTable({ offers }: { offers: MarketOfferRecord[] }) {
  const [stateFilter, setStateFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')

  const filtered = offers.filter(
    (o) =>
      (stateFilter === 'All' || o.state === stateFilter) &&
      (typeFilter === 'All' || o.offer_type === typeFilter),
  )

  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-white">Market Offers</h2>
        <div className="flex gap-3">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
          >
            {ALL_STATES.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All States' : s}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All Types' : (OFFER_TYPE_LABELS[t] ?? t)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs">
              <th className="pb-2 pr-4">Retailer</th>
              <th className="pb-2 pr-4">State</th>
              <th className="pb-2 pr-4">Offer Name</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4 text-right">Supply ($/day)</th>
              <th className="pb-2 pr-4 text-right">Peak (c/kWh)</th>
              <th className="pb-2 pr-4 text-right">Solar FIT</th>
              <th className="pb-2 text-right">Bill 5000kWh</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.offer_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 font-medium text-white">{o.retailer}</td>
                <td className="py-2 pr-4 text-gray-300">{o.state}</td>
                <td className="py-2 pr-4 text-gray-300 max-w-[180px] truncate">{o.offer_name}</td>
                <td className="py-2 pr-4">
                  <OfferTypeBadge type={o.offer_type} />
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">${o.daily_supply_charge.toFixed(2)}</td>
                <td className="py-2 pr-4 text-right text-gray-300">{o.peak_rate.toFixed(1)}c</td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  {o.solar_fit_rate != null ? `${o.solar_fit_rate.toFixed(1)}c` : '—'}
                </td>
                <td className="py-2 text-right font-semibold text-white">
                  ${o.annual_bill_5000kwh.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-6">No offers match selected filters.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Solar FIT Comparison Table
// ---------------------------------------------------------------------------

function SolarFitTable({ records }: { records: SolarFitRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <h2 className="text-base font-semibold text-white mb-4">Solar Feed-in Tariff Comparison</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs">
              <th className="pb-2 pr-4">State</th>
              <th className="pb-2 pr-4">Retailer</th>
              <th className="pb-2 pr-4">FIT Type</th>
              <th className="pb-2 pr-4 text-right">Rate (c/kWh)</th>
              <th className="pb-2 pr-4 text-center">Min Rate</th>
              <th className="pb-2 pr-4 text-center">Time-Varying</th>
              <th className="pb-2 pr-4 text-right">Peak FIT</th>
              <th className="pb-2 text-right">Off-Peak FIT</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => (
              <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 pr-4 text-gray-300">{r.state}</td>
                <td className="py-2 pr-4 font-medium text-white">{r.retailer}</td>
                <td className="py-2 pr-4">
                  <FitTypeBadge type={r.fit_type} />
                </td>
                <td className="py-2 pr-4 text-right font-semibold text-green-400">
                  {r.fit_rate_c_kwh.toFixed(1)}c
                </td>
                <td className="py-2 pr-4 text-center">
                  {r.minimum_rate ? (
                    <span className="text-yellow-400 text-xs font-medium">Yes</span>
                  ) : (
                    <span className="text-gray-500 text-xs">No</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-center">
                  {r.time_varying ? (
                    <span className="text-blue-400 text-xs font-medium">Yes</span>
                  ) : (
                    <span className="text-gray-500 text-xs">No</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  {r.peak_fit_c_kwh != null ? `${r.peak_fit_c_kwh.toFixed(1)}c` : '—'}
                </td>
                <td className="py-2 text-right text-gray-300">
                  {r.off_peak_fit_c_kwh != null ? `${r.off_peak_fit_c_kwh.toFixed(1)}c` : '—'}
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
// Tariff Structure Cards
// ---------------------------------------------------------------------------

function TariffCard({ t }: { t: TariffStructureRecord }) {
  return (
    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-white">{t.retailer}</p>
          <p className="text-xs text-gray-400">{t.state}</p>
        </div>
        <OfferTypeBadge type={t.tariff_type} />
      </div>
      <p className="text-xs text-gray-400 mb-2">
        <span className="font-medium text-gray-300">Peak hours:</span> {t.peak_hours}
      </p>
      <div className="grid grid-cols-2 gap-1 text-xs mb-2">
        <div>
          <span className="text-gray-500">Peak</span>
          <p className="text-red-400 font-semibold">{t.peak_rate.toFixed(1)}c/kWh</p>
        </div>
        <div>
          <span className="text-gray-500">Off-Peak</span>
          <p className="text-green-400 font-semibold">{t.off_peak_rate.toFixed(1)}c/kWh</p>
        </div>
        {t.shoulder_rate != null && (
          <div>
            <span className="text-gray-500">Shoulder</span>
            <p className="text-yellow-400 font-semibold">{t.shoulder_rate.toFixed(1)}c/kWh</p>
          </div>
        )}
        {t.demand_charge_kw_month != null && (
          <div>
            <span className="text-gray-500">Demand</span>
            <p className="text-purple-400 font-semibold">${t.demand_charge_kw_month.toFixed(2)}/kW/mo</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {t.battery_optimisation && (
          <span className="bg-teal-800 text-teal-200 text-xs px-2 py-0.5 rounded">Battery Optimised</span>
        )}
        {t.ev_charging_discount_pct != null && (
          <span className="bg-green-800 text-green-200 text-xs px-2 py-0.5 rounded">
            EV Discount {t.ev_charging_discount_pct}%
          </span>
        )}
      </div>
    </div>
  )
}

function TariffStructureGrid({ tariffs }: { tariffs: TariffStructureRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <h2 className="text-base font-semibold text-white mb-4">Tariff Structure Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tariffs.map((t, idx) => (
          <TariffCard key={idx} t={t} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RetailOfferComparison() {
  const [dashboard, setDashboard] = useState<RetailOfferComparisonDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getRetailOfferComparisonDashboard()
      .then(setDashboard)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading retail offer comparison data...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data.'}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Tag className="text-blue-400 mt-1 shrink-0" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Retail Offer Comparison</h1>
          <p className="text-gray-400 text-sm mt-1">
            Compare Default Market Offers vs market offers, time-of-use and demand tariff structures,
            and solar feed-in tariff rates across Australia's retail electricity market.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Market Discount vs DMO"
          value={`${dashboard.avg_market_discount_pct.toFixed(1)}%`}
          icon={<Percent size={24} />}
          accent="text-green-400"
        />
        <KpiCard
          label="Cheapest Offer State"
          value={dashboard.cheapest_offer_state}
          icon={<MapPin size={24} />}
          accent="text-blue-400"
        />
        <KpiCard
          label="Avg Solar FIT Rate"
          value={`${dashboard.avg_solar_fit_rate.toFixed(2)}c/kWh`}
          icon={<Sun size={24} />}
          accent="text-yellow-400"
        />
        <KpiCard
          label="TOU Adoption"
          value={`${dashboard.tou_adoption_pct.toFixed(1)}%`}
          icon={<Zap size={24} />}
          accent="text-purple-400"
        />
      </div>

      {/* DMO vs Market Chart */}
      <DmoMarketChart data={dashboard.dmo_vs_market} />

      {/* Market Offers Table */}
      <MarketOffersTable offers={dashboard.market_offers} />

      {/* Solar FIT Table */}
      <SolarFitTable records={dashboard.solar_fit_records} />

      {/* Tariff Structure Cards */}
      <TariffStructureGrid tariffs={dashboard.tariff_structures} />
    </div>
  )
}
