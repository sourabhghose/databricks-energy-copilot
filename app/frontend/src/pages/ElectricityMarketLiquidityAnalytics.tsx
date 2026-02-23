import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { BarChart2, Zap, TrendingUp, DollarSign } from 'lucide-react'
import {
  getElectricityMarketLiquidityDashboard,
  EMLADashboard,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const REGION_COLOURS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#facc15',
  VIC1: '#34d399',
  SA1:  '#fb923c',
  TAS1: '#a78bfa',
}

const TIME_COLOURS: Record<string, string> = {
  Peak:      '#f87171',
  Shoulder:  '#fb923c',
  'Off-peak': '#4ade80',
}

const TYPE_COLOURS: Record<string, string> = {
  Gentailer:      '#22d3ee',
  'Pure Retailer': '#a78bfa',
  Trader:         '#fb923c',
  Financial:      '#f87171',
}

const SEVERITY_COLOURS: Record<string, string> = {
  High:   '#f87171',
  Medium: '#fb923c',
  Low:    '#4ade80',
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
export default function ElectricityMarketLiquidityAnalytics() {
  const [data, setData] = useState<EMLADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityMarketLiquidityDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-900">
        Loading Electricity Market Liquidity Analytics...
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

  // ─── Chart 1: Line — traded_volume_twh by quarter for 5 regions ──────────────
  const quartersSet = new Set<string>()
  data.trading_volumes.forEach(tv => quartersSet.add(tv.quarter))
  const quarters = Array.from(quartersSet).sort()
  const tvLineData = quarters.map(q => {
    const row: Record<string, string | number> = { quarter: q }
    ;['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].forEach(region => {
      const rec = data.trading_volumes.find(tv => tv.quarter === q && tv.region === region)
      row[region] = rec ? rec.traded_volume_twh : 0
    })
    return row
  })

  // ─── Chart 2: Bar — liquidity_score by region × time_of_day (grouped) ────────
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const liqBarData = regions.map(region => {
    const row: Record<string, string | number> = { region }
    ;['Peak', 'Shoulder', 'Off-peak'].forEach(tod => {
      const recs = data.market_depth.filter(md => md.region === region && md.time_of_day === tod)
      row[tod] = recs.length > 0
        ? Math.round((recs.reduce((sum, r) => sum + r.liquidity_score, 0) / recs.length) * 10) / 10
        : 0
    })
    return row
  })

  // ─── Chart 3: Bar — market_share_pct by participant coloured by participant_type ──
  const participantShareMap: Record<string, { total: number; type: string }> = {}
  data.participants.forEach(p => {
    if (!participantShareMap[p.participant_name]) {
      participantShareMap[p.participant_name] = { total: 0, type: p.participant_type }
    }
    participantShareMap[p.participant_name].total += p.market_share_pct
  })
  const participantBarData = Object.entries(participantShareMap).map(([name, v]) => ({
    participant_name: name,
    market_share_pct: Math.round((v.total / 5) * 10) / 10,  // avg across 5 regions
    participant_type: v.type,
  })).sort((a, b) => b.market_share_pct - a.market_share_pct)

  // ─── Chart 4: Line — avg_hedge_ratio_pct by year for 5 regions ───────────────
  const hedgeYearsSet = new Set<number>()
  data.hedging_metrics.forEach(hm => hedgeYearsSet.add(hm.year))
  const hedgeYears = Array.from(hedgeYearsSet).sort((a, b) => a - b)
  const hedgeLineData = hedgeYears.map(yr => {
    const row: Record<string, string | number> = { year: String(yr) }
    ;['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].forEach(region => {
      const rec = data.hedging_metrics.find(hm => hm.year === yr && hm.region === region)
      row[region] = rec ? rec.avg_hedge_ratio_pct : 0
    })
    return row
  })

  // ─── Chart 5: Bar — estimated_impact_m by risk_factor coloured by severity ───
  const riskBarData = ['Price Spike', 'Generator Exit', 'Renewable Entry', 'Market Concentration', 'Regulatory Change'].map(rf => {
    const recs = data.liquidity_risks.filter(lr => lr.risk_factor === rf)
    const totalImpact = recs.reduce((sum, r) => sum + r.estimated_impact_m, 0)
    const dominantSeverity = recs.length > 0
      ? recs.reduce((prev, cur) => {
          const order: Record<string, number> = { High: 3, Medium: 2, Low: 1 }
          return (order[cur.severity] ?? 0) > (order[prev.severity] ?? 0) ? cur : prev
        }).severity
      : 'Low'
    return {
      risk_factor: rf.replace(' ', '\n'),
      risk_factor_full: rf,
      estimated_impact_m: Math.round(totalImpact * 100) / 100,
      severity: dominantSeverity,
    }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Electricity Market Liquidity Analytics</h1>
          <p className="text-sm text-gray-400">
            NEM OTC derivatives market — trading volumes, market depth, participants, hedging metrics and liquidity risks
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Traded Volume"
          value={`${summary.total_traded_volume_twh ?? '—'} TWh`}
          sub="Across all quarters and regions"
          Icon={Zap}
        />
        <KpiCard
          label="Avg Liquidity Score"
          value={`${summary.avg_liquidity_score ?? '—'} / 100`}
          sub="Market depth weighted average"
          Icon={BarChart2}
        />
        <KpiCard
          label="Most Liquid Region"
          value={String(summary.most_liquid_region ?? '—')}
          sub="Highest average liquidity score"
          Icon={TrendingUp}
        />
        <KpiCard
          label="Avg Hedge Ratio"
          value={`${summary.avg_hedge_ratio_pct ?? '—'}%`}
          sub={`Top risk: ${summary.highest_risk_factor ?? '—'}`}
          Icon={DollarSign}
        />
      </div>

      {/* Chart 1: Line — traded_volume_twh by quarter for 5 regions */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Traded Volume by Quarter (TWh) — 5 Regions
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={tvLineData} margin={{ top: 4, right: 16, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="quarter"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" TWh" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`${val.toFixed(3)} TWh`]}
            />
            <Legend />
            {(['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const).map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region]}
                strokeWidth={2}
                dot={false}
                name={region}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Bar — liquidity_score by region × time_of_day (grouped) */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Avg Liquidity Score by Region and Time of Day (0–100)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={liqBarData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`${val.toFixed(1)}`, 'Score']}
            />
            <Legend />
            {(['Peak', 'Shoulder', 'Off-peak'] as const).map(tod => (
              <Bar
                key={tod}
                dataKey={tod}
                fill={TIME_COLOURS[tod]}
                name={tod}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Bar — market_share_pct by participant coloured by participant_type */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Avg Market Share by Participant (%) — Coloured by Type
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={participantBarData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="participant_name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`${val.toFixed(1)}%`, 'Market Share']}
            />
            <Bar dataKey="market_share_pct" name="Market Share (%)">
              {participantBarData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={TYPE_COLOURS[entry.participant_type] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(TYPE_COLOURS).map(([type, colour]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Chart 4: Line — avg_hedge_ratio_pct by year for 5 regions */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Avg Hedge Ratio by Year (%) — 5 Regions
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={hedgeLineData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[40, 100]} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`${val.toFixed(1)}%`]}
            />
            <Legend />
            {(['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'] as const).map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={REGION_COLOURS[region]}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={region}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Bar — estimated_impact_m by risk_factor coloured by severity */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          Estimated Impact by Risk Factor ($M) — Coloured by Severity
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={riskBarData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="risk_factor_full" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(val: number) => [`$${val.toFixed(2)}M`, 'Est. Impact']}
            />
            <Bar dataKey="estimated_impact_m" name="Estimated Impact ($M)">
              {riskBarData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={SEVERITY_COLOURS[entry.severity] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-6 mt-3">
          {Object.entries(SEVERITY_COLOURS).map(([sev, colour]) => (
            <div key={sev} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {sev}
            </div>
          ))}
        </div>
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
