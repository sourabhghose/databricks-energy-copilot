import { useEffect, useState } from 'react'
import { BarChart2, DollarSign, Activity, MapPin, Zap } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getElectricityMarketMicrostructureDashboard,
  EMMSDashboard,
} from '../api/client'

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Colour maps ───────────────────────────────────────────────────────────────
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#3b82f6',
  QLD1: '#f59e0b',
  VIC1: '#8b5cf6',
  SA1:  '#ef4444',
  TAS1: '#10b981',
}

const FUEL_COLOURS: Record<string, string> = {
  Coal:    '#78716c',
  Gas:     '#f97316',
  Wind:    '#06b6d4',
  Solar:   '#fbbf24',
  Hydro:   '#3b82f6',
  Battery: '#a855f7',
  Diesel:  '#ef4444',
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ElectricityMarketMicrostructureAnalytics() {
  const [data, setData] = useState<EMMSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityMarketMicrostructureDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Electricity Market Microstructure Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )
  }

  const { bid_spreads, liquidity, price_formation, participant_activity, predispatch_accuracy, settlement, summary } = data

  // ── Chart 1: Bid-Offer Spread by Region ─────────────────────────────────────
  const bidSpreadByRegion: Record<string, { region: string; avg_bid: number; avg_offer: number; spread: number; count: number }> = {}
  bid_spreads.forEach(r => {
    if (!bidSpreadByRegion[r.region]) {
      bidSpreadByRegion[r.region] = { region: r.region, avg_bid: 0, avg_offer: 0, spread: 0, count: 0 }
    }
    bidSpreadByRegion[r.region].avg_bid += r.avg_bid_price_mwh
    bidSpreadByRegion[r.region].avg_offer += r.avg_offer_price_mwh
    bidSpreadByRegion[r.region].spread += r.bid_offer_spread_mwh
    bidSpreadByRegion[r.region].count += 1
  })
  const bidSpreadData = Object.values(bidSpreadByRegion).map(v => ({
    region: v.region,
    'Avg Bid ($/MWh)': parseFloat((v.avg_bid / v.count).toFixed(2)),
    'Avg Offer ($/MWh)': parseFloat((v.avg_offer / v.count).toFixed(2)),
    'Spread ($/MWh)': parseFloat((v.spread / v.count).toFixed(2)),
  }))

  // ── Chart 2: Market Liquidity Trend (first 12 months) ───────────────────────
  const liquidityData = liquidity.slice(0, 12).map(r => ({
    month: r.date_month,
    region: r.region,
    'Market Depth (MW)': r.market_depth_mw,
    'HHI': parseFloat((r.herfindahl_index * 1000).toFixed(1)),
  }))

  // ── Chart 3: Price Formation by Fuel ────────────────────────────────────────
  const priceByFuel: Record<string, { fuel: string; total: number; count: number }> = {}
  price_formation.forEach(r => {
    if (!priceByFuel[r.marginal_fuel]) {
      priceByFuel[r.marginal_fuel] = { fuel: r.marginal_fuel, total: 0, count: 0 }
    }
    priceByFuel[r.marginal_fuel].total += r.settlement_price_mwh
    priceByFuel[r.marginal_fuel].count += 1
  })
  const priceFormationData = Object.values(priceByFuel).map(v => ({
    fuel: v.fuel,
    'Avg Settlement Price ($/MWh)': parseFloat((v.total / v.count).toFixed(2)),
    count: v.count,
  }))

  // ── Chart 4: Pre-dispatch Accuracy (scatter) ─────────────────────────────────
  const scatterData = predispatch_accuracy.map(r => ({
    x: r.forecast_price_mwh,
    y: r.actual_price_mwh,
    region: r.region,
    pct_error: r.pct_error,
  }))

  const scatterByRegion: Record<string, { x: number; y: number }[]> = {}
  scatterData.forEach(d => {
    if (!scatterByRegion[d.region]) scatterByRegion[d.region] = []
    scatterByRegion[d.region].push({ x: d.x, y: d.y })
  })

  // ── Chart 5: Participant Rebid Activity (horizontal bar) ─────────────────────
  const rebidData = [...participant_activity]
    .sort((a, b) => b.strategic_rebid_pct - a.strategic_rebid_pct)
    .slice(0, 15)
    .map(r => ({
      participant: r.participant.split(' ')[0],
      'Strategic Rebid %': parseFloat(r.strategic_rebid_pct.toFixed(1)),
    }))

  // ── Chart 6: Settlement Revenue by Region ────────────────────────────────────
  const settlementByRegion: Record<string, { region: string; pool: number; mrq: number; residue: number; count: number }> = {}
  settlement.forEach(r => {
    if (!settlementByRegion[r.region]) {
      settlementByRegion[r.region] = { region: r.region, pool: 0, mrq: 0, residue: 0, count: 0 }
    }
    settlementByRegion[r.region].pool += r.pool_revenue_m
    settlementByRegion[r.region].mrq += r.mrq_revenue_m
    settlementByRegion[r.region].residue += r.settlement_residue_m
    settlementByRegion[r.region].count += 1
  })
  const settlementData = Object.values(settlementByRegion).map(v => ({
    region: v.region,
    'Pool Revenue ($M)': parseFloat(v.pool.toFixed(2)),
    'MRQ Revenue ($M)': parseFloat(v.mrq.toFixed(2)),
    'Settlement Residue ($M)': parseFloat(v.residue.toFixed(2)),
  }))

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 size={28} className="text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Electricity Market Microstructure Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            NEM spot market microstructure — bid-offer spreads, settlement price formation, dispatch interval liquidity &amp; pre-dispatch accuracy
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Bid-Offer Spread"
          value={`$${typeof summary.avg_bid_offer_spread_mwh === 'number' ? summary.avg_bid_offer_spread_mwh.toFixed(2) : summary.avg_bid_offer_spread_mwh}/MWh`}
          sub="5-min interval average"
          icon={BarChart2}
          colour="bg-blue-600"
        />
        <KpiCard
          label="Avg Pre-dispatch Error"
          value={`${typeof summary.avg_predispatch_error_pct === 'number' ? summary.avg_predispatch_error_pct.toFixed(1) : summary.avg_predispatch_error_pct}%`}
          sub="Forecast vs actual price"
          icon={Activity}
          colour="bg-amber-600"
        />
        <KpiCard
          label="Most Liquid Region"
          value={String(summary.most_liquid_region)}
          sub="By aggregate market depth"
          icon={MapPin}
          colour="bg-green-600"
        />
        <KpiCard
          label="Most Competitive Fuel"
          value={String(summary.most_competitive_fuel)}
          sub="By marginal dispatch count"
          icon={Zap}
          colour="bg-purple-600"
        />
      </div>

      {/* Chart 1: Bid-Offer Spread by Region */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-4">Bid-Offer Spread by Region</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={bidSpreadData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/MWh" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }} />
            <Legend />
            <Bar dataKey="Avg Bid ($/MWh)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Avg Offer ($/MWh)" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Spread ($/MWh)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Market Liquidity Trend */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-4">Market Liquidity Trend — Depth &amp; HHI (x1000)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={liquidityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="Market Depth (MW)" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="HHI" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Price Formation by Fuel */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-4">Average Settlement Price by Marginal Fuel</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={priceFormationData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="fuel" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $/MWh" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }} />
            <Legend />
            <Bar dataKey="Avg Settlement Price ($/MWh)" radius={[3, 3, 0, 0]}>
              {priceFormationData.map((entry) => (
                <Cell key={entry.fuel} fill={FUEL_COLOURS[entry.fuel] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Pre-dispatch Accuracy Scatter */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-4">Pre-dispatch Accuracy — Forecast vs Actual Price ($/MWh)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="x" name="Forecast Price" unit=" $/MWh" tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: 'Forecast Price ($/MWh)', position: 'insideBottom', offset: -5, fill: '#9ca3af' }} />
            <YAxis dataKey="y" name="Actual Price" unit=" $/MWh" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }} />
            <Legend />
            {Object.entries(scatterByRegion).map(([region, points]) => (
              <Scatter
                key={region}
                name={region}
                data={points}
                fill={REGION_COLOURS[region] ?? '#6b7280'}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Participant Rebid Activity */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-4">Participant Strategic Rebid Activity (Top 15)</h2>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            layout="vertical"
            data={rebidData}
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" />
            <YAxis type="category" dataKey="participant" tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }} />
            <Legend />
            <Bar dataKey="Strategic Rebid %" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Settlement Revenue by Region */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-1">Settlement Revenue by Region ($M)</h2>
        <p className="text-xs text-gray-400 mb-4">Pool revenue, MRQ, and settlement residue aggregated per region</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={settlementData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" $M" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#fff' }} />
            <Legend />
            <Bar dataKey="Pool Revenue ($M)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="MRQ Revenue ($M)" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Settlement Residue ($M)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary footer */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-lg font-semibold mb-3">Summary Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key} className="bg-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-400 capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-lg font-bold text-white mt-1">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Total Pool Revenue callout */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 text-sm text-blue-200">
        <span className="font-semibold">Total Pool Revenue:</span>{' '}
        ${typeof summary.total_pool_revenue_m === 'number' ? summary.total_pool_revenue_m.toFixed(2) : summary.total_pool_revenue_m}M
        &nbsp;|&nbsp;
        <span className="font-semibold">Strategic Rebid Avg:</span>{' '}
        {typeof summary.strategic_rebid_pct_avg === 'number' ? summary.strategic_rebid_pct_avg.toFixed(1) : summary.strategic_rebid_pct_avg}%
        &nbsp;|&nbsp;
        <span className="font-semibold">Most Liquid Region:</span>{' '}
        {String(summary.most_liquid_region)}
        &nbsp;|&nbsp;
        <span className="font-semibold">Dominant Marginal Fuel:</span>{' '}
        {String(summary.most_competitive_fuel)}
      </div>
    </div>
  )
}
