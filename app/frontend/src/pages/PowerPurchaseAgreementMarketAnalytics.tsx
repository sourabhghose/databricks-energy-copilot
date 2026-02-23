import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { FileText, Zap, DollarSign, TrendingUp } from 'lucide-react'
import {
  getPowerPurchaseAgreementMarketDashboard,
  PPAMDashboard,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const TECH_COLOURS: Record<string, string> = {
  'Solar':             '#facc15',
  'Wind':              '#60a5fa',
  'Hybrid':            '#34d399',
  'Firmed Renewable':  '#a78bfa',
}

const SCENARIO_COLOURS: Record<string, string> = {
  'Base':               '#60a5fa',
  'Corporate RE Push':  '#34d399',
  'Policy Incentives':  '#fb923c',
}

const PROBABILITY_COLOURS: Record<string, string> = {
  'High':   '#f87171',
  'Medium': '#fb923c',
  'Low':    '#4ade80',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon }: {
  label: string; value: string; sub?: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
      <div className="p-3 bg-gray-700 rounded-lg">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PowerPurchaseAgreementMarketAnalytics() {
  const [data, setData] = useState<PPAMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPowerPurchaseAgreementMarketDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900">
        Loading Power Purchase Agreement Market Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 bg-gray-900">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  // ─── Chart 1: Bar — capacity_mw by buyer (top 15) coloured by technology ─────
  const buyerCapMap: Record<string, Record<string, number>> = {}
  data.contracts.forEach(c => {
    if (!buyerCapMap[c.buyer]) buyerCapMap[c.buyer] = {}
    buyerCapMap[c.buyer][c.technology] = (buyerCapMap[c.buyer][c.technology] ?? 0) + c.capacity_mw
  })
  const buyerCapData = Object.entries(buyerCapMap)
    .map(([buyer, techMap]) => ({
      buyer,
      total: Object.values(techMap).reduce((a, b) => a + b, 0),
      ...techMap,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)
  const techKeys = Array.from(new Set(data.contracts.map(c => c.technology)))

  // ─── Chart 2: Line — avg_strike_price by quarter for 3 technologies ──────────
  const quartersSet = new Set<string>()
  data.price_index.forEach(p => quartersSet.add(p.quarter))
  const quarters = Array.from(quartersSet).sort()
  const piLineData = quarters.map(q => {
    const row: Record<string, string | number> = { quarter: q }
    ;['Solar', 'Wind', 'Hybrid'].forEach(tech => {
      const rec = data.price_index.find(p => p.quarter === q && p.technology === tech)
      row[tech] = rec ? rec.avg_strike_price : 0
    })
    return row
  })

  // ─── Chart 3: Bar — total_contracted_mw by buyer_sector coloured by re100 ────
  const sectorMap: Record<string, { mw: number; re100: boolean }> = {}
  data.buyer_analysis.forEach(ba => {
    if (!sectorMap[ba.buyer_sector]) {
      sectorMap[ba.buyer_sector] = { mw: 0, re100: ba.re100_committed }
    }
    sectorMap[ba.buyer_sector].mw += ba.total_contracted_mw
  })
  const sectorBarData = Object.entries(sectorMap).map(([sector, v]) => ({
    buyer_sector: sector,
    total_contracted_mw: Math.round(v.mw * 10) / 10,
    re100: v.re100,
  }))

  // ─── Chart 4: Bar — impact_per_mwh by risk_type coloured by probability ──────
  const riskBarData = data.risk_factors.map(rf => ({
    risk_type: rf.risk_type.replace(' Risk', ''),
    impact_per_mwh: rf.impact_per_mwh,
    probability: rf.probability,
  })).sort((a, b) => b.impact_per_mwh - a.impact_per_mwh)

  // ─── Chart 5: Line — total_capacity_gw by year for 3 scenarios ───────────────
  const projYearsSet = new Set<number>()
  data.projections.forEach(p => projYearsSet.add(p.year))
  const projYears = Array.from(projYearsSet).sort((a, b) => a - b)
  const projLineData = projYears.map(yr => {
    const row: Record<string, string | number> = { year: String(yr) }
    ;['Base', 'Corporate RE Push', 'Policy Incentives'].forEach(sc => {
      const rec = data.projections.find(p => p.year === yr && p.scenario === sc)
      row[sc] = rec ? rec.total_capacity_gw : 0
    })
    return row
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Power Purchase Agreement Market Analytics</h1>
          <p className="text-sm text-gray-400">
            Corporate PPA contracts, price trends, buyer analysis, risk factors and market projections
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Contracted Capacity"
          value={`${summary.total_contracted_capacity_gw ?? '—'} GW`}
          sub="Across all active & signed contracts"
          Icon={Zap}
        />
        <KpiCard
          label="Active Contracts"
          value={String(summary.active_contracts ?? '—')}
          sub="Currently in operation"
          Icon={FileText}
        />
        <KpiCard
          label="Avg Strike Price"
          value={`$${summary.avg_strike_price_per_mwh ?? '—'}/MWh`}
          sub="Volume-weighted across all contracts"
          Icon={DollarSign}
        />
        <KpiCard
          label="Market Value"
          value={`$${summary.market_value_b ?? '—'}B`}
          sub={`Largest sector: ${summary.largest_buyer_sector ?? '—'}`}
          Icon={TrendingUp}
        />
      </div>

      {/* Chart 1: Bar — capacity_mw by buyer (top 15) coloured by technology */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Contracted Capacity by Buyer (Top 15, MW) — Coloured by Technology
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={buyerCapData} margin={{ top: 4, right: 16, bottom: 60, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="buyer"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ paddingTop: 12 }} />
            {techKeys.map(tech => (
              <Bar
                key={tech}
                dataKey={tech}
                stackId="stack"
                fill={TECH_COLOURS[tech] ?? '#6b7280'}
                name={tech}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Line — avg_strike_price by quarter for Solar/Wind/Hybrid */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          PPA Strike Price Index by Quarter ($/MWh) — Solar, Wind, Hybrid
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={piLineData} margin={{ top: 4, right: 16, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="quarter"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            {['Solar', 'Wind', 'Hybrid'].map(tech => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLOURS[tech] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={tech}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Bar — total_contracted_mw by buyer_sector coloured by re100_committed */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Total Contracted MW by Buyer Sector (RE100 Committed = cyan, Non-committed = amber)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sectorBarData} margin={{ top: 4, right: 16, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="buyer_sector"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`${val.toFixed(1)} MW`, 'Contracted']}
            />
            <Bar dataKey="total_contracted_mw" name="Contracted MW">
              {sectorBarData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.re100 ? '#22d3ee' : '#fb923c'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-6 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#22d3ee' }} />
            RE100 Committed
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#fb923c' }} />
            Not RE100 Committed
          </div>
        </div>
      </div>

      {/* Chart 4: Bar — impact_per_mwh by risk_type coloured by probability */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Risk Factor Impact ($/MWh) — Coloured by Probability
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={riskBarData} margin={{ top: 4, right: 16, bottom: 50, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="risk_type"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`$${val.toFixed(2)}/MWh`, 'Impact']}
            />
            <Bar dataKey="impact_per_mwh" name="Impact ($/MWh)">
              {riskBarData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={PROBABILITY_COLOURS[entry.probability] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-6 mt-3">
          {Object.entries(PROBABILITY_COLOURS).map(([prob, colour]) => (
            <div key={prob} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {prob}
            </div>
          ))}
        </div>
      </div>

      {/* Chart 5: Line — total_capacity_gw by year for 3 scenarios */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          PPA Market Capacity Projections 2025–2035 (GW) by Scenario
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={projLineData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend />
            {['Base', 'Corporate RE Push', 'Policy Incentives'].map(sc => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                stroke={SCENARIO_COLOURS[sc] ?? '#6b7280'}
                strokeWidth={2}
                dot={false}
                name={sc}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary dl grid */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(summary).map(([key, val]) => (
            <div key={key} className="bg-gray-700 rounded-lg p-3">
              <dt className="text-xs text-gray-400 uppercase tracking-wide break-words">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-base font-semibold text-white mt-1 break-words">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
