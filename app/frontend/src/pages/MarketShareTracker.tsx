import { useEffect, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts'
import { Users, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react'
import { getMarketShareDashboard, MarketShareDashboard } from '../api/client'

// ---- colour palette -------------------------------------------------------
const PARTICIPANT_COLORS: Record<string, string> = {
  AGL:             '#6366f1',
  Origin:          '#f59e0b',
  EnergyAustralia: '#10b981',
  Snowy:           '#3b82f6',
  'CS Energy':     '#ef4444',
  Stanwell:        '#8b5cf6',
  Alinta:          '#ec4899',
  Macquarie:       '#14b8a6',
  Shell:           '#f97316',
  BP:              '#84cc16',
  Tilt:            '#06b6d4',
  Neoen:           '#a855f7',
  Others:          '#6b7280',
}

const HHI_BAND_COLOR = (hhi: number) => {
  if (hhi >= 2500) return '#ef4444'
  if (hhi >= 1800) return '#f59e0b'
  if (hhi >= 1000) return '#3b82f6'
  return '#10b981'
}

const SHARE_CELL_COLOR = (pct: number) => {
  if (pct >= 25) return 'bg-red-900/60 text-red-200'
  if (pct >= 15) return 'bg-amber-900/60 text-amber-200'
  if (pct >= 8)  return 'bg-blue-900/60 text-blue-200'
  if (pct >= 3)  return 'bg-emerald-900/60 text-emerald-200'
  return 'bg-gray-800/40 text-gray-400'
}

const COMPETITION_BADGE: Record<string, string> = {
  COMPETITIVE:         'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
  MODERATE:            'bg-blue-900/50 text-blue-300 border border-blue-700',
  CONCENTRATED:        'bg-amber-900/50 text-amber-300 border border-amber-700',
  HIGHLY_CONCENTRATED: 'bg-red-900/50 text-red-300 border border-red-700',
}

// ---- KPI card -------------------------------------------------------------
function KpiCard({
  label, value, unit, sub, icon: Icon, colour,
}: {
  label: string; value: string | number; unit?: string; sub?: string
  icon: React.ElementType; colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">
          {value}
          {unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
        </p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---- main page ------------------------------------------------------------
export default function MarketShareTracker() {
  const [data, setData]           = useState<MarketShareDashboard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState('NSW')
  const [selectedYear, setSelectedYear]     = useState(2024)

  useEffect(() => {
    getMarketShareDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-gray-400 animate-pulse">Loading market share data…</div>
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-red-400">Error: {error ?? 'No data'}</div>
    </div>
  )

  // ---- derived values -----------------------------------------------------
  const latestParticipants = data.participants.filter(p => p.year === selectedYear)
  const latestConcentration = data.concentration.filter(c => c.year === selectedYear)

  const topShare  = Math.max(...latestParticipants.map(p => p.market_share_pct))
  const nationalHhi = Math.round(
    latestConcentration.reduce((s, c) => s + c.hhi_score, 0) / latestConcentration.length
  )
  const highlyConcentrated = latestConcentration.filter(
    c => c.competition_level === 'HIGHLY_CONCENTRATED'
  ).length
  const totalMa = data.ownership_changes.reduce((s, o) => s + o.transaction_value_m_aud, 0)

  // ---- portfolio stacked bar data -----------------------------------------
  const portfolioData = latestParticipants
    .sort((a, b) => b.portfolio_mw - a.portfolio_mw)
    .map(p => ({
      name: p.name.replace(' Energy', '').replace(' Corp.', '').replace(' Australia', ''),
      Renewable: p.renewable_mw,
      Thermal:   p.thermal_mw,
      Storage:   p.storage_mw,
    }))

  // ---- HHI trend data for grouped bar ------------------------------------
  const regions = ['NSW', 'QLD', 'VIC', 'SA', 'WA']
  const hhi_years = [2022, 2023, 2024]
  const hhiTrendData = regions.map(region => {
    const entry: Record<string, number | string> = { region }
    hhi_years.forEach(yr => {
      const rec = data.concentration.find(c => c.region === region && c.year === yr)
      entry[String(yr)] = rec ? rec.hhi_score : 0
    })
    return entry
  })

  // ---- pie chart data -----------------------------------------------------
  const regionParticipants = latestParticipants
    .filter(p => p.region === selectedRegion || true) // use all, not filtered by region
    .reduce<Record<string, number>>((acc, p) => {
      acc[p.name] = (acc[p.name] ?? 0) + p.portfolio_mw
      return acc
    }, {})

  const sortedPie = Object.entries(regionParticipants)
    .sort((a, b) => b[1] - a[1])
  const top8Pie = sortedPie.slice(0, 8)
  const othersTotal = sortedPie.slice(8).reduce((s, [, v]) => s + v, 0)
  const pieData = [
    ...top8Pie.map(([name, mw]) => ({ name: name.replace(' Energy', '').replace(' Australia', ''), mw })),
    ...(othersTotal > 0 ? [{ name: 'Others', mw: Math.round(othersTotal) }] : []),
  ]

  // ---- heatmap data -------------------------------------------------------
  const heatParticipants = ['AGL', 'Origin', 'EnergyAustralia', 'Snowy', 'CS Energy', 'Stanwell']
  const heatRegions = ['NSW', 'QLD', 'VIC', 'SA', 'WA']
  const heatMap: Record<string, Record<string, number>> = {}
  heatParticipants.forEach(p => { heatMap[p] = {} })
  data.regional_shares.forEach(r => {
    if (heatParticipants.includes(r.participant) && heatRegions.includes(r.region)) {
      heatMap[r.participant][r.region] = r.generation_share_pct
    }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Users size={28} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">
            NEM Participant Market Share &amp; Concentration Tracker
          </h1>
        </div>
        <p className="text-gray-400 text-sm ml-11">
          Generator portfolio concentration, market power analysis, and ownership changes across the NEM.
        </p>
      </div>

      {/* Year selector */}
      <div className="flex gap-2 mb-6">
        {[2022, 2023, 2024].map(yr => (
          <button
            key={yr}
            onClick={() => setSelectedYear(yr)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedYear === yr
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {yr}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Top Participant Share" value={topShare.toFixed(1)} unit="%"
          sub="National portfolio MW basis" icon={TrendingUp} colour="bg-indigo-600" />
        <KpiCard label="National Avg HHI" value={nationalHhi}
          sub="Herfindahl–Hirschman Index" icon={Users} colour="bg-amber-600" />
        <KpiCard label="Highly Concentrated Regions" value={highlyConcentrated}
          sub="HHI > 2,500 threshold" icon={AlertTriangle} colour="bg-red-600" />
        <KpiCard label="Total M&amp;A Value" value={totalMa.toFixed(0)} unit="M AUD"
          sub={`${data.ownership_changes.length} transactions since 2020`}
          icon={DollarSign} colour="bg-emerald-600" />
      </div>

      {/* Portfolio stacked bar */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-white mb-4">
          Participant Portfolio Composition — {selectedYear} (MW)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={portfolioData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toLocaleString()} MW`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Renewable" stackId="a" fill="#10b981">
              <LabelList dataKey="Renewable" position="inside" style={{ fontSize: 0 }} />
            </Bar>
            <Bar dataKey="Thermal" stackId="a" fill="#ef4444" />
            <Bar dataKey="Storage" stackId="a" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* HHI trend + pie row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* HHI grouped bar */}
        <div className="lg:col-span-3 bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-4">
            Regional HHI Concentration Trend (2022–2024)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hhiTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 3500]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="2022" fill="#6366f1" radius={[2, 2, 0, 0]} />
              <Bar dataKey="2023" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="2024" fill="#a855f7" radius={[2, 2, 0, 0]} />
              {/* 2500 reference line via custom label */}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2">
            HHI &gt; 2,500 = Highly Concentrated (red zone); 1,800–2,500 = Concentrated
          </p>
        </div>

        {/* Pie chart */}
        <div className="lg:col-span-2 bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-1">
            Portfolio MW Share — Top 8
          </h2>
          <p className="text-xs text-gray-500 mb-2">All regions, {selectedYear}</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="mw" nameKey="name"
                cx="50%" cy="50%" outerRadius={85}
                label={({ name, percent }) =>
                  percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                }
                labelLine={false}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx}
                    fill={PARTICIPANT_COLORS[entry.name] ?? '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: number) => [`${v.toLocaleString()} MW`]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Concentration table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-white mb-4">
          Regional Concentration Metrics — {selectedYear}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-4">Region</th>
                <th className="text-right py-2 pr-4">HHI Score</th>
                <th className="text-right py-2 pr-4">CR3 %</th>
                <th className="text-right py-2 pr-4">CR5 %</th>
                <th className="text-left py-2 pr-4">Dominant</th>
                <th className="text-left py-2">Competition Level</th>
              </tr>
            </thead>
            <tbody>
              {latestConcentration.map(c => (
                <tr key={c.region} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                  <td className="py-2.5 pr-4 font-medium text-white">{c.region}</td>
                  <td className="py-2.5 pr-4 text-right font-mono"
                    style={{ color: HHI_BAND_COLOR(c.hhi_score) }}>
                    {c.hhi_score.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-300">{c.cr3_pct.toFixed(1)}%</td>
                  <td className="py-2.5 pr-4 text-right text-gray-300">{c.cr5_pct.toFixed(1)}%</td>
                  <td className="py-2.5 pr-4 text-gray-300">{c.dominant_participant}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${COMPETITION_BADGE[c.competition_level]}`}>
                      {c.competition_level.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ownership change timeline */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-white mb-4">
          Ownership Change Timeline
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-4">Year</th>
                <th className="text-left py-2 pr-4">Acquirer</th>
                <th className="text-left py-2 pr-4">Target / Assets</th>
                <th className="text-right py-2 pr-4">Capacity MW</th>
                <th className="text-right py-2 pr-4">Value M AUD</th>
                <th className="text-right py-2 pr-4">HHI Impact</th>
                <th className="text-left py-2">Regulatory</th>
              </tr>
            </thead>
            <tbody>
              {data.ownership_changes.map((o, i) => (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                  <td className="py-2.5 pr-4 font-mono text-indigo-300">{o.year}</td>
                  <td className="py-2.5 pr-4 font-medium text-white">{o.acquirer}</td>
                  <td className="py-2.5 pr-4 text-gray-400 text-xs max-w-xs">{o.assets_transferred}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-300">{o.capacity_mw.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-right text-emerald-400">
                    ${o.transaction_value_m_aud.toFixed(0)}
                  </td>
                  <td className={`py-2.5 pr-4 text-right font-mono ${
                    o.impact_on_hhi > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {o.impact_on_hhi > 0 ? '+' : ''}{o.impact_on_hhi.toFixed(1)}
                  </td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-700">
                      {o.regulatory_approval}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regional share heatmap */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <h2 className="text-base font-semibold text-white mb-1">
          Regional Generation Share Heatmap — {selectedYear} (%)
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Colour scale: red &ge;25%, amber &ge;15%, blue &ge;8%, green &ge;3%, grey &lt;3%
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                <th className="text-left py-2 pr-4 w-40">Participant</th>
                {heatRegions.map(r => (
                  <th key={r} className="text-center py-2 px-3">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatParticipants.map(p => (
                <tr key={p} className="border-b border-gray-700/50">
                  <td className="py-2.5 pr-4 font-medium text-white">{p}</td>
                  {heatRegions.map(r => {
                    const val = heatMap[p]?.[r] ?? 0
                    return (
                      <td key={r} className="py-1.5 px-1 text-center">
                        <span className={`inline-block w-16 py-1 rounded text-xs font-mono font-semibold ${SHARE_CELL_COLOR(val)}`}>
                          {val > 0 ? `${val.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Participant detail line chart — market share trend */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-white mb-4">
          Market Share Trend 2022–2024 — Top Participants (%)
        </h2>
        {(() => {
          const topNames = ['AGL Energy', 'Origin Energy', 'EnergyAustralia', 'Snowy Hydro']
          const lineData = [2022, 2023, 2024].map(yr => {
            const entry: Record<string, number | string> = { year: String(yr) }
            topNames.forEach(n => {
              const rec = data.participants.find(p => p.name === n && p.year === yr)
              entry[n.replace(' Energy', '').replace(' Hydro', '')] = rec?.market_share_pct ?? 0
            })
            return entry
          })
          const shortNames = topNames.map(n =>
            n.replace(' Energy', '').replace(' Hydro', '')
          )
          const colors = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6']
          return (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#f9fafb' }}
                  itemStyle={{ color: '#d1d5db' }}
                  formatter={(v: number) => [`${v.toFixed(2)}%`]}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                {shortNames.map((n, i) => (
                  <Line key={n} type="monotone" dataKey={n}
                    stroke={colors[i]} strokeWidth={2}
                    dot={{ r: 4, fill: colors[i] }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )
        })()}
      </div>
    </div>
  )
}
