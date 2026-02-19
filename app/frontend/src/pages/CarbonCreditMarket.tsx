import { useEffect, useState } from 'react'
import { TreePine, AlertCircle, Loader2 } from 'lucide-react'
import {
  api,
  CarbonCreditMarketDashboard,
  AccuSpotRecord,
  CarbonOffsetProjectRecord,
  CarbonOffsetBuyerRecord,
  AccuPriceForecastRecord,
} from '../api/client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function projectTypeBadge(type: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (type) {
    case 'REFORESTATION':        return <span className={`${base} bg-green-700 text-green-100`}>REFORESTATION</span>
    case 'SOIL_CARBON':          return <span className={`${base} bg-amber-700 text-amber-100`}>SOIL CARBON</span>
    case 'SAVANNA_BURNING':      return <span className={`${base} bg-orange-700 text-orange-100`}>SAVANNA BURNING</span>
    case 'LANDFILL_GAS':         return <span className={`${base} bg-gray-600 text-gray-100`}>LANDFILL GAS</span>
    case 'AVOIDED_DEFORESTATION':return <span className={`${base} bg-teal-700 text-teal-100`}>AVOIDED DEFORESTATION</span>
    default:                     return <span className={`${base} bg-purple-700 text-purple-100`}>{type}</span>
  }
}

function offsetPurposeBadge(purpose: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  switch (purpose) {
    case 'SAFEGUARD_COMPLIANCE': return <span className={`${base} bg-red-700 text-red-100`}>SAFEGUARD</span>
    case 'VOLUNTARY_NET_ZERO':   return <span className={`${base} bg-green-700 text-green-100`}>VOLUNTARY</span>
    case 'EXPORT':               return <span className={`${base} bg-blue-700 text-blue-100`}>EXPORT</span>
    default:                     return <span className={`${base} bg-gray-600 text-gray-100`}>{purpose}</span>
  }
}

function stateBadge(state: string) {
  const map: Record<string, string> = {
    QLD: 'bg-purple-700 text-purple-100',
    NSW: 'bg-blue-700 text-blue-100',
    VIC: 'bg-indigo-700 text-indigo-100',
    WA:  'bg-yellow-700 text-yellow-100',
    SA:  'bg-red-700 text-red-100',
    NT:  'bg-orange-700 text-orange-100',
    TAS: 'bg-teal-700 text-teal-100',
    ACT: 'bg-cyan-700 text-cyan-100',
  }
  const cls = map[state] ?? 'bg-gray-600 text-gray-100'
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{state}</span>
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  unit,
  sub,
  valueColor,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold" style={{ color: valueColor ?? '#fff' }}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ACCU Price History Chart
// ---------------------------------------------------------------------------

function AccuPriceHistoryChart({ data }: { data: AccuSpotRecord[] }) {
  // Build dataset grouped by date with separate series for GENERIC and HIR
  const dateMap: Record<string, { date: string; GENERIC?: number; HUMAN_INDUCED_REGEN?: number; LANDFILL?: number; SAVANNA_BURNING?: number }> = {}
  for (const rec of data) {
    if (!dateMap[rec.trade_date]) {
      dateMap[rec.trade_date] = { date: rec.trade_date.slice(5) } // show MM-DD
    }
    if (rec.accu_type === 'GENERIC') dateMap[rec.trade_date].GENERIC = rec.spot_price_aud
    if (rec.accu_type === 'HUMAN_INDUCED_REGEN') dateMap[rec.trade_date].HUMAN_INDUCED_REGEN = rec.spot_price_aud
    if (rec.accu_type === 'LANDFILL') dateMap[rec.trade_date].LANDFILL = rec.spot_price_aud
    if (rec.accu_type === 'SAVANNA_BURNING') dateMap[rec.trade_date].SAVANNA_BURNING = rec.spot_price_aud
  }
  const chartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          tickFormatter={v => `$${v}`}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#E5E7EB' }}
          formatter={(v: number) => [`$${fmt(v)}`, '']}
        />
        <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
        <Line type="monotone" dataKey="GENERIC" stroke="#60A5FA" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="HUMAN_INDUCED_REGEN" stroke="#34D399" strokeWidth={2} dot={false} connectNulls name="HIR" />
        <Line type="monotone" dataKey="LANDFILL" stroke="#9CA3AF" strokeWidth={1.5} dot={false} connectNulls />
        <Line type="monotone" dataKey="SAVANNA_BURNING" stroke="#F59E0B" strokeWidth={1.5} dot={false} connectNulls name="SAVANNA" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Carbon Price Forecast Chart
// ---------------------------------------------------------------------------

interface ForecastChartPoint {
  year: number
  BASE?: number
  HIGH?: number
  LOW?: number
  EU_ETS?: number
}

function CarbonPriceForecastChart({ data }: { data: AccuPriceForecastRecord[] }) {
  const yearMap: Record<number, ForecastChartPoint> = {}
  for (const rec of data) {
    if (!yearMap[rec.year]) yearMap[rec.year] = { year: rec.year }
    if (rec.scenario === 'BASE') {
      yearMap[rec.year].BASE = rec.accu_price_forecast_aud
      yearMap[rec.year].EU_ETS = rec.eu_ets_aud
    }
    if (rec.scenario === 'HIGH') yearMap[rec.year].HIGH = rec.accu_price_forecast_aud
    if (rec.scenario === 'LOW')  yearMap[rec.year].LOW  = rec.accu_price_forecast_aud
  }
  const chartData = Object.values(yearMap).sort((a, b) => a.year - b.year)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          tickFormatter={v => `$${v}`}
          domain={[0, 'auto']}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#E5E7EB' }}
          formatter={(v: number) => [`$${fmt(v)} AUD`, '']}
        />
        <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
        <Line type="monotone" dataKey="HIGH" stroke="#F87171" strokeWidth={2} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="BASE" stroke="#60A5FA" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="LOW"  stroke="#6B7280" strokeWidth={2} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="EU_ETS" stroke="#A78BFA" strokeWidth={1.5} dot={false} name="EU ETS (AUD)" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Carbon Projects Table
// ---------------------------------------------------------------------------

function CarbonProjectsTable({ data }: { data: CarbonOffsetProjectRecord[] }) {
  const [typeFilter, setTypeFilter] = useState('ALL')
  const types = ['ALL', ...Array.from(new Set(data.map(p => p.project_type))).sort()]
  const filtered = typeFilter === 'ALL' ? data : data.filter(p => p.project_type === typeFilter)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={[
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              typeFilter === t
                ? 'bg-green-700 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
            ].join(' ')}
          >
            {t === 'ALL' ? 'ALL' : t.replace('_', ' ')}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="py-2 pr-3">Project</th>
              <th className="py-2 pr-3">Developer</th>
              <th className="py-2 pr-3">State</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Methodology</th>
              <th className="py-2 pr-3 text-right">Issued ACCUs</th>
              <th className="py-2 pr-3 text-right">Price ($/ACCU)</th>
              <th className="py-2 pr-3 text-right">Vintage</th>
              <th className="py-2 pr-3">Permanence</th>
              <th className="py-2">Co-Benefits</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-3 font-semibold text-gray-200 max-w-48">
                  <span title={p.project_name}>{p.project_name.length > 32 ? p.project_name.slice(0,32)+'…' : p.project_name}</span>
                </td>
                <td className="py-2 pr-3 text-gray-300 max-w-36">
                  <span title={p.developer}>{p.developer.length > 24 ? p.developer.slice(0,24)+'…' : p.developer}</span>
                </td>
                <td className="py-2 pr-3">{stateBadge(p.state)}</td>
                <td className="py-2 pr-3">{projectTypeBadge(p.project_type)}</td>
                <td className="py-2 pr-3 text-gray-400 text-xs max-w-40">
                  <span title={p.methodology}>{p.methodology.length > 28 ? p.methodology.slice(0,28)+'…' : p.methodology}</span>
                </td>
                <td className="py-2 pr-3 text-right text-gray-200 font-mono">{p.issued_units.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-green-400 font-semibold">${fmt(p.price_aud)}</td>
                <td className="py-2 pr-3 text-right text-gray-300">{p.vintage_year}</td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.permanence_rating === '100Y' ? 'bg-green-800 text-green-200' : 'bg-amber-800 text-amber-200'}`}>
                    {p.permanence_rating}
                  </span>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {p.co_benefits.map(b => (
                      <span key={b} className="px-1.5 py-0.5 rounded bg-gray-600 text-gray-200 text-xs">{b.replace('_', ' ')}</span>
                    ))}
                  </div>
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
// Corporate Buyers Table
// ---------------------------------------------------------------------------

function CorporateBuyersTable({ data }: { data: CarbonOffsetBuyerRecord[] }) {
  const sorted = [...data].sort((a, b) => b.accus_purchased_2024 - a.accus_purchased_2024)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
            <th className="py-2 pr-4">Company</th>
            <th className="py-2 pr-4">Sector</th>
            <th className="py-2 pr-4 text-right">ACCUs Purchased 2024</th>
            <th className="py-2 pr-4 text-right">Avg Price ($/ACCU)</th>
            <th className="py-2 pr-4 text-right">Total Spend ($M)</th>
            <th className="py-2 pr-4">Purpose</th>
            <th className="py-2 text-right">Net Zero Target</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b, i) => (
            <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
              <td className="py-2 pr-4 font-semibold text-gray-200">{b.company_name}</td>
              <td className="py-2 pr-4 text-gray-400 text-xs">{b.sector}</td>
              <td className="py-2 pr-4 text-right text-gray-200 font-mono">{b.accus_purchased_2024.toLocaleString()}</td>
              <td className="py-2 pr-4 text-right text-amber-400 font-semibold">${fmt(b.avg_price_paid)}</td>
              <td className="py-2 pr-4 text-right text-blue-400 font-semibold">${fmt(b.total_spend_m_aud)}M</td>
              <td className="py-2 pr-4">{offsetPurposeBadge(b.offset_purpose)}</td>
              <td className="py-2 text-right text-gray-300 font-semibold">
                {b.net_zero_target_year ?? <span className="text-gray-500">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CarbonCreditMarket() {
  const [dashboard, setDashboard] = useState<CarbonCreditMarketDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getCarbonCreditDashboard()
      .then(data => {
        setDashboard(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err?.message ?? 'Failed to load carbon credit market data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <Loader2 className="animate-spin text-green-400 mr-3" size={28} />
        <span className="text-gray-400 text-sm">Loading carbon credit market data...</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <AlertCircle className="text-red-400 mr-3" size={24} />
        <span className="text-red-400 text-sm">{error ?? 'No data available'}</span>
      </div>
    )
  }

  const spot     = dashboard.spot_records as AccuSpotRecord[]
  const projects = dashboard.projects as CarbonOffsetProjectRecord[]
  const buyers   = dashboard.buyers as CarbonOffsetBuyerRecord[]
  const forecasts= dashboard.price_forecasts as AccuPriceForecastRecord[]

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <TreePine className="text-green-400 mt-1 shrink-0" size={28} />
        <div>
          <h1 className="text-xl font-bold text-gray-100">Australian Carbon Credit &amp; Offset Market</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            ACCU spot and futures market, voluntary carbon offsets, corporate net-zero buyers and international carbon price benchmarks
          </p>
          <p className="text-xs text-gray-500 mt-1">Updated: {dashboard.timestamp}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Current ACCU Price"
          value={`$${fmt(dashboard.current_accu_price)}`}
          unit="/ unit"
          sub="Generic ACCU spot"
          valueColor="#34D399"
        />
        <KpiCard
          label="Total Issued"
          value={fmt(dashboard.total_issued_mtco2, 3)}
          unit="Mt CO2-e"
          sub="Across all project types"
          valueColor="#60A5FA"
        />
        <KpiCard
          label="Safeguard Demand"
          value={fmt(dashboard.safeguard_demand_ktco2, 0)}
          unit="kt CO2"
          sub="Compliance buyer purchases"
          valueColor="#F59E0B"
        />
        <KpiCard
          label="Market Size"
          value={`$${fmt(dashboard.market_size_b_aud, 3)}`}
          unit="B AUD"
          sub="Total corporate spend"
          valueColor="#A78BFA"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ACCU Price History */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
            ACCU Spot Price History — Jan to Jun 2024
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Daily spot prices (AUD/ACCU) by credit type. HIR (Human-Induced Regeneration) commands premium pricing.
          </p>
          <AccuPriceHistoryChart data={spot} />
        </div>

        {/* Carbon Price Forecast */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
            Carbon Price Forecast 2024–2035
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            ACCU price scenarios (BASE/HIGH/LOW) alongside EU ETS converted to AUD for international benchmarking.
          </p>
          <CarbonPriceForecastChart data={forecasts} />
        </div>
      </div>

      {/* Top Carbon Projects */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wide">
          Australian Carbon Offset Projects
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Registered projects under the Emissions Reduction Fund (ERF) across methodologies, states and vintage years.
          Filter by project type to compare pricing and co-benefit profiles.
        </p>
        <CarbonProjectsTable data={projects} />
      </div>

      {/* Corporate Buyers */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wide">
          Corporate Carbon Offset Buyers — 2024
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Major Australian corporates purchasing ACCUs for Safeguard compliance or voluntary net-zero commitments.
          Sorted by purchase volume.
        </p>
        <CorporateBuyersTable data={buyers} />
      </div>

      {/* Market notes */}
      <div className="bg-gray-800/60 rounded-lg p-4 text-xs text-gray-500 space-y-1 border border-gray-700">
        <p><span className="text-gray-400 font-semibold">Data source:</span> Clean Energy Regulator (CER), ERF project registry, ASX Carbon market, CarbonMarkets.com.au. Data is indicative and for illustrative purposes only.</p>
        <p><span className="text-gray-400 font-semibold">ACCU types:</span> GENERIC — any eligible offset; HIR — Human-Induced Regeneration (native forest regrowth); LANDFILL — methane capture; SAVANNA — fire management in northern Australia.</p>
        <p><span className="text-gray-400 font-semibold">Safeguard Mechanism:</span> Large industrial facilities exceeding 100kt CO2-e/yr must surrender ACCUs or Safeguard Mechanism Credits (SMCs) for emissions above their baseline.</p>
      </div>
    </div>
  )
}
