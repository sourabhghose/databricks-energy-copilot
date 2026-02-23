import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from 'recharts'
import {
  getElectricityConsumerSwitchingChurnDashboard,
  ECSCDashboard,
} from '../api/client'

const STATE_COLORS: Record<string, string> = {
  NSW: '#6366f1',
  VIC: '#22c55e',
  QLD: '#f59e0b',
  SA:  '#ef4444',
  WA:  '#22d3ee',
}

const BARRIER_COLOR_YES = '#22c55e'
const BARRIER_COLOR_NO  = '#6b7280'

export default function ElectricityConsumerSwitchingChurnAnalytics() {
  const [data, setData] = useState<ECSCDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityConsumerSwitchingChurnDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-300">
        <span className="text-lg">Loading Consumer Switching &amp; Churn Analytics...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 text-red-400">
        <span className="text-lg">Error: {error ?? 'No data available'}</span>
      </div>
    )
  }

  const { switching, retailer_churn, barriers, price_comparison, segments, trends, summary } = data

  // ---- KPI Cards ----
  const kpis = [
    {
      label: 'Avg Switching Rate',
      value: `${(summary.avg_switching_rate_pct as number).toFixed(1)}%`,
      sub: 'Annual retail market churn',
      color: 'text-indigo-400',
    },
    {
      label: 'Avg Annual Saving',
      value: `$${(summary.avg_annual_saving_potential_aud as number).toLocaleString()}`,
      sub: 'For active switchers (AUD)',
      color: 'text-green-400',
    },
    {
      label: 'Digital Switch Share',
      value: `${(summary.digital_switch_pct_latest as number).toFixed(1)}%`,
      sub: 'Latest year digital channel',
      color: 'text-cyan-400',
    },
    {
      label: 'Default Offer Customers',
      value: `${(summary.default_offer_customers_pct as number).toFixed(1)}%`,
      sub: 'Still on standing/default offer',
      color: 'text-amber-400',
    },
  ]

  // ---- Chart 1: Switching Rate by State (LineChart quarterly) ----
  const stateList = ['NSW', 'VIC', 'QLD', 'SA', 'WA']
  const allQuarters = [...new Set(switching.map((s) => s.year_quarter))].sort()
  const switchByStateQuarter: Record<string, Record<string, number>> = {}
  for (const rec of switching) {
    if (!switchByStateQuarter[rec.year_quarter]) switchByStateQuarter[rec.year_quarter] = {}
    switchByStateQuarter[rec.year_quarter][rec.state] = rec.switching_rate_pct
  }
  const switchRateData = allQuarters.map((q) => {
    const row: Record<string, string | number> = { quarter: q }
    for (const st of stateList) {
      if (switchByStateQuarter[q]?.[st] !== undefined) row[st] = switchByStateQuarter[q][st]
    }
    return row
  })

  // ---- Chart 2: Retailer Net Churn (horizontal BarChart sorted) ----
  const retailerNetChurn = [...retailer_churn]
    .sort((a, b) => b.net_churn_rate_pct - a.net_churn_rate_pct)
    .map((r) => ({
      name: r.retailer.replace(' Energy', '').replace('Energy', ''),
      net_churn_rate_pct: r.net_churn_rate_pct,
      retailer: r.retailer,
    }))

  // ---- Chart 3: Switching Barriers (horizontal BarChart) ----
  const barrierData = [...barriers]
    .sort((a, b) => b.affected_customers_pct - a.affected_customers_pct)
    .map((b) => ({
      name: b.barrier_type,
      affected_customers_pct: b.affected_customers_pct,
      policy_available: b.policy_intervention_available,
    }))

  // ---- Chart 4: Price Saving Potential (grouped BarChart by state × quarter) ----
  const priceStateGroups = ['NSW', 'VIC', 'QLD', 'SA', 'WA']
  const priceByStateQ: Record<string, Record<string, { dmo: number; best: number }>> = {}
  for (const p of price_comparison) {
    if (!priceByStateQ[p.quarter]) priceByStateQ[p.quarter] = {}
    priceByStateQ[p.quarter][p.state] = { dmo: p.avg_dmo_rate_cts_kwh, best: p.avg_best_offer_cts_kwh }
  }
  const priceQuarters = [...new Set(price_comparison.map((p) => p.quarter))].sort().slice(-8)
  const priceSavingData = priceQuarters.map((q) => {
    const row: Record<string, string | number> = { quarter: q }
    for (const st of priceStateGroups) {
      if (priceByStateQ[q]?.[st]) {
        row[`${st}_dmo`] = priceByStateQ[q][st].dmo
        row[`${st}_best`] = priceByStateQ[q][st].best
      }
    }
    return row
  })

  // ---- Chart 5: Segment Engagement (ScatterChart) ----
  const segmentScatterData = segments.map((s) => ({
    x: s.engagement_score,
    y: s.switching_rate_pct,
    z: s.avg_saving_aud,
    name: s.segment,
    policy: s.policy_support_needed,
  }))

  // ---- Chart 6: Digital Switch Trend (LineChart by year) ----
  const trendYears = [...new Set(trends.map((t) => t.year))].sort()
  const digitalByYear: Record<number, { digital: number[]; green: number[]; default_offer: number[] }> = {}
  for (const t of trends) {
    if (!digitalByYear[t.year]) digitalByYear[t.year] = { digital: [], green: [], default_offer: [] }
    digitalByYear[t.year].digital.push(t.digital_switch_pct)
    digitalByYear[t.year].green.push(t.green_tariff_uptake_pct)
    digitalByYear[t.year].default_offer.push(t.default_offer_customers_pct)
  }
  const digitalTrendData = trendYears.map((yr) => {
    const d = digitalByYear[yr]
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    return {
      year: yr.toString(),
      digital_switch_pct: Math.round(avg(d.digital) * 10) / 10,
      green_tariff_uptake_pct: Math.round(avg(d.green) * 10) / 10,
      default_offer_customers_pct: Math.round(avg(d.default_offer) * 10) / 10,
    }
  })

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Electricity Consumer Switching &amp; Churn Analytics
          </h1>
          <p className="text-gray-400 text-sm">
            Retail electricity market switching rates by state, retailer-specific churn,
            switching triggers, price comparison site activity, barriers to switching
            (solar FIT, hardship, complexity), and consumer engagement across Australia.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-gray-500 text-xs mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart 1: Switching Rate by State */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Switching Rate by State (Quarterly)</h2>
        <p className="text-gray-400 text-xs mb-4">
          Annual switching rate (%) tracked quarterly by NEM state. NSW and VIC typically
          lead switching activity due to more competitive retail markets. SA shows elevated
          switching following Default Market Offer reforms. Switching rates trending upward
          from ~20% toward 25%+ as digital comparison tools drive engagement.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {stateList.map((st) => (
            <span key={st} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: STATE_COLORS[st] }} />
              {st}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={switchRateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" stroke="#9ca3af" tick={{ fontSize: 11 }} interval={1} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              domain={[14, 32]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            />
            <Legend />
            {stateList.map((st) => (
              <Line
                key={st}
                type="monotone"
                dataKey={st}
                stroke={STATE_COLORS[st]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Retailer Net Churn */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Retailer Net Churn Rate (%)</h2>
        <p className="text-gray-400 text-xs mb-4">
          Net churn rate (gross churn minus new acquisitions) per retailer, sorted descending.
          Positive values indicate net customer loss; negative values indicate net growth.
          Challenger retailers (Red Energy, Powershop) tend toward negative net churn
          (gaining customers), while incumbents manage higher gross churn rates.
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={retailerNetChurn} layout="vertical" margin={{ left: 140, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} width={135} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`${v.toFixed(2)}%`, 'Net Churn Rate']}
            />
            <Bar dataKey="net_churn_rate_pct" name="Net Churn Rate (%)">
              {retailerNetChurn.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={entry.net_churn_rate_pct > 0 ? '#ef4444' : '#22c55e'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Switching Barriers */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Switching Barriers by Affected Customer Share</h2>
        <p className="text-gray-400 text-xs mb-4">
          Proportion of customers affected by each switching barrier, sorted by prevalence.
          Green bars indicate a policy intervention is available; grey bars have no current
          intervention. Solar FIT lock-in affects the largest share (solar households reluctant
          to switch and potentially lose favourable feed-in tariff arrangements).
        </p>
        <div className="flex gap-4 mb-3">
          <span className="flex items-center gap-1 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: BARRIER_COLOR_YES }} />
            Policy intervention available
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: BARRIER_COLOR_NO }} />
            No intervention
          </span>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={barrierData} layout="vertical" margin={{ left: 165, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} width={160} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, 'Customers Affected']}
            />
            <Bar dataKey="affected_customers_pct" name="Customers Affected (%)">
              {barrierData.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={entry.policy_available ? BARRIER_COLOR_YES : BARRIER_COLOR_NO}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Price Saving Potential */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          DMO Rate vs Best Market Offer (c/kWh) by State
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Default Market Offer (DMO) rate compared to the best available market offer
          in cents per kWh, grouped by state and quarter. The gap between DMO and best
          offer represents annual savings of $200–$400 for engaged customers. SA shows
          the highest absolute rates and savings potential due to its high-cost network.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          {['NSW', 'VIC', 'QLD'].map((st) => (
            <span key={st} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: STATE_COLORS[st] }} />
              {st} DMO / Best
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={priceSavingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" stroke="#9ca3af" tick={{ fontSize: 10 }} interval={1} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}c`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, name: string) => [`${v.toFixed(2)} c/kWh`, name]}
            />
            <Legend />
            <Bar dataKey="NSW_dmo" name="NSW DMO" fill={STATE_COLORS['NSW']} opacity={0.9} />
            <Bar dataKey="NSW_best" name="NSW Best" fill={STATE_COLORS['NSW']} opacity={0.45} />
            <Bar dataKey="VIC_dmo" name="VIC DMO" fill={STATE_COLORS['VIC']} opacity={0.9} />
            <Bar dataKey="VIC_best" name="VIC Best" fill={STATE_COLORS['VIC']} opacity={0.45} />
            <Bar dataKey="QLD_dmo" name="QLD DMO" fill={STATE_COLORS['QLD']} opacity={0.9} />
            <Bar dataKey="QLD_best" name="QLD Best" fill={STATE_COLORS['QLD']} opacity={0.45} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Segment Engagement ScatterChart */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Segment Engagement vs Switching Rate
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Scatter of consumer segments: X-axis is engagement score (1-10), Y-axis is
          switching rate (%), bubble size represents average annual saving (AUD). EV owners
          and Urban Professionals show high engagement and switching rates. Low Income and
          Digitally Excluded segments show low engagement and miss out on significant savings.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="x"
              name="Engagement Score"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              domain={[1, 10]}
              label={{ value: 'Engagement Score', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              dataKey="y"
              name="Switching Rate"
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <ZAxis dataKey="z" range={[40, 350]} name="Avg Saving (AUD)" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(v: number, name: string) => {
                if (name === 'Engagement Score') return [`${v.toFixed(1)}`, name]
                if (name === 'Switching Rate') return [`${v.toFixed(1)}%`, name]
                if (name === 'Avg Saving (AUD)') return [`$${v}`, name]
                return [v, name]
              }}
            />
            <Scatter
              data={segmentScatterData}
              name="Segment"
            >
              {segmentScatterData.map((entry, idx) => (
                <Cell
                  key={`seg-${idx}`}
                  fill={entry.policy ? '#f59e0b' : '#6366f1'}
                  opacity={0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-400" />
            Policy support needed
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-300">
            <span className="inline-block w-3 h-3 rounded-full bg-indigo-400" />
            No policy intervention required
          </span>
        </div>
      </div>

      {/* Chart 6: Digital Switch Trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Digital Switching &amp; Green Tariff Uptake Trend (2019–2024)
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Proportion of switches completed via digital channels (%) and green tariff
          uptake (%) year-on-year, overlaid with default offer customer share. Digital
          switching grew from ~30% to over 60% as comparison portals matured and
          COVID-19 accelerated online behaviour. Default offer customers have declined
          from ~60% to under 35% following AER pricing reforms.
        </p>
        <div className="flex flex-wrap gap-4 mb-3">
          {[
            { key: 'digital_switch_pct', label: 'Digital Switch %', color: '#6366f1' },
            { key: 'green_tariff_uptake_pct', label: 'Green Tariff Uptake %', color: '#22c55e' },
            { key: 'default_offer_customers_pct', label: 'Default Offer Customers %', color: '#f59e0b' },
          ].map((item) => (
            <span key={item.key} className="flex items-center gap-1 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={digitalTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 75]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="digital_switch_pct"
              name="Digital Switch %"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="green_tariff_uptake_pct"
              name="Green Tariff Uptake %"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="default_offer_customers_pct"
              name="Default Offer Customers %"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Footer */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">Market Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Avg Switching Rate</p>
            <p className="text-xl font-bold text-indigo-400">
              {(summary.avg_switching_rate_pct as number).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Avg Annual Saving</p>
            <p className="text-xl font-bold text-green-400">
              ${(summary.avg_annual_saving_potential_aud as number).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Highest Churn Retailer</p>
            <p className="text-base font-bold text-red-400 leading-tight">
              {summary.highest_churn_retailer as string}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Lowest Barrier Segment</p>
            <p className="text-base font-bold text-cyan-400 leading-tight">
              {summary.lowest_barrier_segment as string}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Digital Switch Share</p>
            <p className="text-xl font-bold text-indigo-300">
              {(summary.digital_switch_pct_latest as number).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">On Default Offer</p>
            <p className="text-xl font-bold text-amber-400">
              {(summary.default_offer_customers_pct as number).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
