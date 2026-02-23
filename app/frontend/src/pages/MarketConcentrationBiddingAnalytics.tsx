import { useEffect, useState } from 'react'
import { PieChart } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getMarketConcentrationBiddingDashboard,
  NMCBDashboard,
  NMCBParticipant,
  NMCBBiddingBand,
  NMCBHHITrend,
  NMCBSurveillance,
  NMCBCompetition,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour maps
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  Gentailer:   '#6366f1',
  Generator:   '#22c55e',
  Aggregator:  '#f59e0b',
}

const BAND_COLORS = {
  band_1: '#22c55e',
  band_2: '#3b82f6',
  band_3: '#f59e0b',
  band_4: '#ef4444',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#6366f1',
  QLD1: '#22c55e',
  VIC1: '#f59e0b',
  SA1:  '#ec4899',
  TAS1: '#06b6d4',
}

const ACTION_COLORS: Record<string, string> = {
  Monitoring:    '#22c55e',
  Warning:       '#f59e0b',
  Investigation: '#f97316',
  Referral:      '#ef4444',
  Dismissed:     '#6b7280',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 1 — Bar: participant market_power_index coloured by participant_type
// ---------------------------------------------------------------------------

function MarketPowerIndexChart({ participants }: { participants: NMCBParticipant[] }) {
  const data = [...participants]
    .sort((a, b) => b.market_power_index - a.market_power_index)
    .map(p => ({
      name: p.participant_name.length > 16 ? p.participant_name.slice(0, 16) + '…' : p.participant_name,
      fullName: p.participant_name,
      market_power_index: p.market_power_index,
      participant_type: p.participant_type,
    }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Market Power Index by Participant (coloured by Type)
      </h3>
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 9 }}
            angle={-45}
            textAnchor="end"
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            domain={[0, 10]}
            label={{ value: 'MPI (0–10)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(val: number, _name: string, props: { payload?: { fullName?: string; participant_type?: string } }) => [
              `${val.toFixed(2)}`,
              `MPI — ${props?.payload?.fullName ?? ''} (${props?.payload?.participant_type ?? ''})`,
            ]}
          />
          <Bar dataKey="market_power_index" name="Market Power Index" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry, idx) => (
              <Cell key={`mpi-cell-${idx}`} fill={TYPE_COLORS[entry.participant_type] ?? '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-2">
        {Object.entries(TYPE_COLORS).map(([t, col]) => (
          <span key={t} className="flex items-center gap-1 text-xs text-gray-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 2 — Stacked bar: bidding band volume distribution by participant
// ---------------------------------------------------------------------------

function BiddingBandChart({ bands, participants }: { bands: NMCBBiddingBand[]; participants: NMCBParticipant[] }) {
  const nameMap: Record<string, string> = {}
  for (const p of participants) {
    nameMap[p.participant_id] = p.participant_name.length > 14
      ? p.participant_name.slice(0, 14) + '…'
      : p.participant_name
  }

  const agg: Record<string, { band_1: number; band_2: number; band_3: number; band_4: number }> = {}
  for (const b of bands) {
    if (!agg[b.participant_id]) agg[b.participant_id] = { band_1: 0, band_2: 0, band_3: 0, band_4: 0 }
    agg[b.participant_id].band_1 += b.band_1_volume_mw
    agg[b.participant_id].band_2 += b.band_2_volume_mw
    agg[b.participant_id].band_3 += b.band_3_volume_mw
    agg[b.participant_id].band_4 += b.band_4_volume_mw
  }

  const data = Object.entries(agg).map(([pid, vals]) => ({
    name: nameMap[pid] ?? pid,
    'Band 1 (≤$0)':     Math.round(vals.band_1),
    'Band 2 ($0–$100)': Math.round(vals.band_2),
    'Band 3 ($100–$300)': Math.round(vals.band_3),
    'Band 4 (>$300)':   Math.round(vals.band_4),
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Bidding Band Volume Distribution by Participant (Stacked MW)
      </h3>
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-30} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'MW (sum)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar dataKey="Band 1 (≤$0)"      stackId="bands" fill={BAND_COLORS.band_1} isAnimationActive={false} />
          <Bar dataKey="Band 2 ($0–$100)"  stackId="bands" fill={BAND_COLORS.band_2} isAnimationActive={false} />
          <Bar dataKey="Band 3 ($100–$300)" stackId="bands" fill={BAND_COLORS.band_3} isAnimationActive={false} />
          <Bar dataKey="Band 4 (>$300)"    stackId="bands" fill={BAND_COLORS.band_4} isAnimationActive={false} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 3 — Line: HHI generation trend by region over 2022–2024
// ---------------------------------------------------------------------------

function HHITrendChart({ hhi_trends }: { hhi_trends: NMCBHHITrend[] }) {
  const regions = Array.from(new Set(hhi_trends.map(h => h.region))).sort()
  const periods: string[] = []
  const seen = new Set<string>()
  for (const h of [...hhi_trends].sort((a, b) => a.year - b.year || a.half - b.half)) {
    const key = `${h.year}-H${h.half}`
    if (!seen.has(key)) { seen.add(key); periods.push(key) }
  }

  const dataMap: Record<string, Record<string, number | string>> = {}
  for (const p of periods) dataMap[p] = { label: p }
  for (const h of hhi_trends) {
    const key = `${h.year}-H${h.half}`
    if (dataMap[key]) dataMap[key][h.region] = h.hhi_generation
  }
  const data = periods.map(p => dataMap[p])

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        HHI Generation Trend by Region (2022–2024)
      </h3>
      <ResponsiveContainer width="100%" height={290}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-45} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'HHI', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {regions.map(region => (
            <Line
              key={region}
              type="monotone"
              dataKey={region}
              stroke={REGION_COLORS[region] ?? '#9ca3af'}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 4 — Bar: surveillance events by event_type and aemo_action
// ---------------------------------------------------------------------------

function SurveillanceChart({ surveillance }: { surveillance: NMCBSurveillance[] }) {
  const eventTypes = Array.from(new Set(surveillance.map(s => s.event_type))).sort()
  const actions = Array.from(new Set(surveillance.map(s => s.aemo_action))).sort()

  const agg: Record<string, Record<string, number>> = {}
  for (const et of eventTypes) {
    agg[et] = {}
    for (const act of actions) agg[et][act] = 0
  }
  for (const s of surveillance) {
    agg[s.event_type][s.aemo_action] = (agg[s.event_type][s.aemo_action] ?? 0) + 1
  }

  const data = eventTypes.map(et => {
    const shortName = et.length > 18 ? et.slice(0, 18) + '…' : et
    const row: Record<string, string | number> = { name: shortName, fullName: et }
    for (const act of actions) row[act] = agg[et][act] ?? 0
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Surveillance Events by Event Type and AEMO Action
      </h3>
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} angle={-30} textAnchor="end" />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          {actions.map(act => (
            <Bar
              key={act}
              dataKey={act}
              stackId="actions"
              fill={ACTION_COLORS[act] ?? '#6b7280'}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart 5 — Bar: regional lerner_index vs price_cost_markup_pct trend
// ---------------------------------------------------------------------------

function LernerMarkupChart({ competition }: { competition: NMCBCompetition[] }) {
  const regions = Array.from(new Set(competition.map(c => c.region))).sort()

  // aggregate per region per year: avg lerner_index and price_cost_markup_pct
  const agg: Record<string, Record<number, { lerner: number[]; pcm: number[] }>> = {}
  for (const c of competition) {
    if (!agg[c.region]) agg[c.region] = {}
    if (!agg[c.region][c.year]) agg[c.region][c.year] = { lerner: [], pcm: [] }
    agg[c.region][c.year].lerner.push(c.lerner_index)
    agg[c.region][c.year].pcm.push(c.price_cost_markup_pct)
  }

  const years = Array.from(new Set(competition.map(c => c.year))).sort()
  const dataMap: Record<number, Record<string, number | string>> = {}
  for (const yr of years) dataMap[yr] = { label: String(yr) }
  for (const [region, yearData] of Object.entries(agg)) {
    for (const [yrStr, vals] of Object.entries(yearData)) {
      const yr = Number(yrStr)
      if (dataMap[yr]) {
        dataMap[yr][`${region}_lerner`] = Math.round((vals.lerner.reduce((a, b) => a + b, 0) / vals.lerner.length) * 1000) / 1000
        dataMap[yr][`${region}_pcm`] = Math.round((vals.pcm.reduce((a, b) => a + b, 0) / vals.pcm.length) * 10) / 10
      }
    }
  }
  const data = years.map(yr => dataMap[yr])

  const regionBarColors = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899']

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Regional Lerner Index vs Price–Cost Markup (%) Trend (2020–2024)
      </h3>
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={data} margin={{ top: 8, right: 40, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis yAxisId="lerner" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Lerner', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} domain={[0, 0.7]} />
          <YAxis yAxisId="pcm" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'PCM %', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 10 }} />
          {regions.map((region, idx) => (
            <Bar
              key={`${region}_pcm`}
              yAxisId="pcm"
              dataKey={`${region}_pcm`}
              name={`${region} PCM%`}
              fill={regionBarColors[idx % regionBarColors.length]}
              opacity={0.7}
              isAnimationActive={false}
            />
          ))}
          {regions.map((region, idx) => (
            <Bar
              key={`${region}_lerner`}
              yAxisId="lerner"
              dataKey={`${region}_lerner`}
              name={`${region} Lerner`}
              fill={regionBarColors[idx % regionBarColors.length]}
              opacity={1.0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MarketConcentrationBiddingAnalytics() {
  const [data, setData] = useState<NMCBDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMarketConcentrationBiddingDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-400 text-sm animate-pulse">Loading market concentration data…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-red-400 text-sm">{error ?? 'No data available'}</span>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-600 rounded-lg">
          <PieChart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">NEM Market Concentration &amp; Bidding Behaviour Analytics</h1>
          <p className="text-sm text-gray-400">Generator market power, HHI trends, bidding patterns and AEMO surveillance — 2022–2024</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Avg HHI 2024"
          value={summary.avg_hhi_2024.toFixed(0)}
          sub="Generation concentration index"
        />
        <KpiCard
          label="Most Concentrated Region"
          value={summary.most_concentrated_region}
          sub="Highest avg HHI 2024"
        />
        <KpiCard
          label="Total Pivotal Events 2024"
          value={summary.total_pivotal_events_2024.toString()}
          sub="Pivotal supplier events"
        />
        <KpiCard
          label="Avg Market Power Index"
          value={summary.avg_market_power_index.toFixed(2)}
          sub="0–10 scale across participants"
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Top 3 Market Share"
          value={`${summary.market_share_top3_pct.toFixed(1)}%`}
          sub="Combined share top-3 participants"
        />
        <KpiCard
          label="Surveillance Events"
          value={summary.total_surveillance_events.toString()}
          sub="Total AEMO surveillance actions"
        />
        <KpiCard
          label="Avg Price–Cost Markup"
          value={`${summary.avg_price_cost_markup_pct.toFixed(1)}%`}
          sub="2024 regional average"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarketPowerIndexChart participants={data.participants} />
        <BiddingBandChart bands={data.bidding_bands} participants={data.participants} />
        <HHITrendChart hhi_trends={data.hhi_trends} />
        <SurveillanceChart surveillance={data.surveillance} />
        <div className="lg:col-span-2">
          <LernerMarkupChart competition={data.competition} />
        </div>
      </div>
    </div>
  )
}
