import { useEffect, useState } from 'react'
import { BarChart2, AlertCircle, Loader2 } from 'lucide-react'
import {
  api,
  BiddingBehaviourDashboard,
  BidWithholdingRecord,
  RebidPatternRecord,
  MarketConcentrationRecord,
  BidPriceDistRecord,
} from '../api/client'
import {
  ComposedChart,
  Bar,
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

function techBadge(tech: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-semibold'
  if (tech === 'COAL')  return <span className={`${base} bg-gray-700 text-gray-100`}>COAL</span>
  if (tech === 'GAS')   return <span className={`${base} bg-gray-500 text-gray-100`}>GAS</span>
  if (tech === 'HYDRO') return <span className={`${base} bg-cyan-700 text-cyan-100`}>HYDRO</span>
  if (tech === 'WIND')  return <span className={`${base} bg-blue-700 text-blue-100`}>WIND</span>
  if (tech === 'SOLAR') return <span className={`${base} bg-amber-600 text-amber-100`}>SOLAR</span>
  return <span className={`${base} bg-purple-700 text-purple-100`}>{tech}</span>
}

function withholdingColor(ratio: number): string {
  if (ratio < 10)  return 'text-green-400'
  if (ratio < 25)  return 'text-amber-400'
  return 'text-red-400'
}

function hhiLabel(hhi: number): { label: string; color: string } {
  if (hhi < 1500) return { label: 'Competitive',         color: 'text-green-400' }
  if (hhi < 2500) return { label: 'Mod. Concentrated',   color: 'text-amber-400' }
  return              { label: 'Highly Concentrated',  color: 'text-red-400'   }
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
// Market Concentration Table
// ---------------------------------------------------------------------------

function MarketConcentrationTable({ data }: { data: MarketConcentrationRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
            <th className="py-2 pr-4">Region</th>
            <th className="py-2 pr-4">Year</th>
            <th className="py-2 pr-4">HHI Index</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">CR3 %</th>
            <th className="py-2 pr-4">Top Participant</th>
            <th className="py-2 pr-4">Top Share %</th>
            <th className="py-2 pr-4">Withholding Events</th>
            <th className="py-2">Avg Withheld MW</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const { label, color } = hhiLabel(row.hhi_index)
            return (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-4 font-semibold text-gray-200">{row.region}</td>
                <td className="py-2 pr-4 text-gray-300">{row.year}</td>
                <td className={`py-2 pr-4 font-bold ${color}`}>{row.hhi_index.toFixed(0)}</td>
                <td className={`py-2 pr-4 text-xs font-semibold ${color}`}>{label}</td>
                <td className="py-2 pr-4 text-gray-300">{row.cr3_pct.toFixed(1)}%</td>
                <td className="py-2 pr-4 text-gray-300">{row.top_participant}</td>
                <td className="py-2 pr-4 text-gray-300">{row.top_share_pct.toFixed(1)}%</td>
                <td className="py-2 pr-4 text-gray-300">{row.withholding_events}</td>
                <td className="py-2 text-gray-300">{row.avg_withholding_mw.toFixed(0)} MW</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Withholding Records Table
// ---------------------------------------------------------------------------

function WithholdingTable({ data }: { data: BidWithholdingRecord[] }) {
  const regions = ['ALL', ...Array.from(new Set(data.map(r => r.region))).sort()]
  const [regionFilter, setRegionFilter] = useState('ALL')

  const filtered = regionFilter === 'ALL' ? data : data.filter(r => r.region === regionFilter)

  return (
    <div className="space-y-3">
      {/* Region filter */}
      <div className="flex gap-2 flex-wrap">
        {regions.map(r => (
          <button
            key={r}
            onClick={() => setRegionFilter(r)}
            className={[
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              regionFilter === r
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
            ].join(' ')}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="py-2 pr-4">Participant</th>
              <th className="py-2 pr-4">Region</th>
              <th className="py-2 pr-4">Technology</th>
              <th className="py-2 pr-4">Registered MW</th>
              <th className="py-2 pr-4">Offered MW</th>
              <th className="py-2 pr-4">Withheld MW</th>
              <th className="py-2 pr-4">Withholding %</th>
              <th className="py-2 pr-4">Spot Price</th>
              <th className="py-2 pr-4">Rebids</th>
              <th className="py-2">Rebid Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-4 font-semibold text-gray-200">{row.participant_name}</td>
                <td className="py-2 pr-4 text-gray-300">{row.region}</td>
                <td className="py-2 pr-4">{techBadge(row.technology)}</td>
                <td className="py-2 pr-4 text-gray-300">{row.registered_capacity_mw.toFixed(0)}</td>
                <td className="py-2 pr-4 text-gray-300">{row.offered_capacity_mw.toFixed(0)}</td>
                <td className="py-2 pr-4 text-amber-300 font-semibold">{row.withheld_mw.toFixed(0)}</td>
                <td className={`py-2 pr-4 font-bold ${withholdingColor(row.withholding_ratio_pct)}`}>
                  {row.withholding_ratio_pct.toFixed(1)}%
                </td>
                <td className="py-2 pr-4 text-gray-300">
                  ${row.spot_price_aud_mwh >= 1000
                    ? `${(row.spot_price_aud_mwh / 1000).toFixed(1)}k`
                    : row.spot_price_aud_mwh.toFixed(0)}
                </td>
                <td className="py-2 pr-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    row.rebid_count >= 6 ? 'bg-red-700 text-red-100' :
                    row.rebid_count >= 3 ? 'bg-amber-700 text-amber-100' :
                    'bg-gray-700 text-gray-300'
                  }`}>
                    {row.rebid_count}
                  </span>
                </td>
                <td className="py-2 text-xs text-gray-400 max-w-xs truncate">{row.rebid_reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rebid Patterns Chart
// ---------------------------------------------------------------------------

function RebidPatternsChart({ data }: { data: RebidPatternRecord[] }) {
  const participants = Array.from(new Set(data.map(r => r.participant_name)))
  const [selectedParticipant, setSelectedParticipant] = useState(participants[0] ?? '')

  const chartData = data
    .filter(r => r.participant_name === selectedParticipant)
    .map(r => ({
      month: r.month,
      'Total Rebids': r.total_rebids,
      'Late Rebids': r.late_rebids,
      'Market Impact': r.market_impact_score,
    }))

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {participants.map(p => (
          <button
            key={p}
            onClick={() => setSelectedParticipant(p)}
            className={[
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              selectedParticipant === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
            ].join(' ')}
          >
            {p}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            yAxisId="rebids"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Rebid Count', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            yAxisId="impact"
            orientation="right"
            domain={[0, 10]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Market Impact (0-10)', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#e5e7eb' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar yAxisId="rebids" dataKey="Total Rebids" fill="#3b82f6" name="Total Rebids" />
          <Bar yAxisId="rebids" dataKey="Late Rebids" fill="#ef4444" name="Late Rebids (<5min)" />
          <Line
            yAxisId="impact"
            type="monotone"
            dataKey="Market Impact"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 4, fill: '#f59e0b' }}
            name="Market Impact Score"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bid Price Distribution Table
// ---------------------------------------------------------------------------

function PriceDistributionTable({ data }: { data: BidPriceDistRecord[] }) {
  const participants = Array.from(new Set(data.map(r => r.participant_name))).sort()
  const priceBands = Array.from(new Set(data.map(r => r.price_band_aud_mwh))).sort((a, b) => a - b)

  function formatBand(b: number): string {
    if (b <= -1000) return '-$1000'
    if (b >= 15000) return '$15000'
    if (b >= 1000)  return `$${(b / 1000).toFixed(0)}k`
    return `$${b}`
  }

  function getVolume(participant: string, band: number): BidPriceDistRecord | undefined {
    return data.find(r => r.participant_name === participant && r.price_band_aud_mwh === band)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
            <th className="py-2 pr-4">Participant</th>
            <th className="py-2 pr-4">Technology</th>
            {priceBands.map(b => (
              <th key={b} className="py-2 pr-3 text-center">{formatBand(b)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {participants.map(p => {
            const row0 = data.find(r => r.participant_name === p)
            return (
              <tr key={p} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-4 font-semibold text-gray-200">{p}</td>
                <td className="py-2 pr-4">{row0 ? techBadge(row0.technology) : null}</td>
                {priceBands.map(b => {
                  const rec = getVolume(p, b)
                  return (
                    <td key={b} className="py-2 pr-3 text-center">
                      {rec ? (
                        <div className="flex flex-col items-center">
                          <span className="text-gray-200 font-medium">{rec.volume_offered_mw.toFixed(0)}</span>
                          <span className="text-gray-500 text-xs">{rec.pct_of_portfolio.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-600 text-gray-400 text-xs">
            <td colSpan={2} className="py-1 italic">Values: MW offered / % of portfolio</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BiddingBehaviour() {
  const [dash, setDash] = useState<BiddingBehaviourDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getBiddingBehaviourDashboard()
      .then(setDash)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading bidding behaviour data…
      </div>
    )
  }

  if (error || !dash) {
    return (
      <div className="flex items-center gap-2 justify-center h-64 text-red-400">
        <AlertCircle size={20} />
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 text-gray-100 min-h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-600 rounded-lg mt-0.5">
          <BarChart2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Wholesale Market Bidding Behaviour & Strategic Withholding
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            NEM participant bidding patterns, capacity withholding analysis, rebid behaviour and market concentration metrics
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Withheld MW"
          value={dash.total_withheld_mw.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          unit="MW"
          sub="Across all dispatch intervals"
          valueColor="#f59e0b"
        />
        <KpiCard
          label="Avg Withholding Ratio"
          value={dash.avg_withholding_ratio_pct.toFixed(1)}
          unit="%"
          sub="Mean across all records"
          valueColor={dash.avg_withholding_ratio_pct >= 25 ? '#ef4444' : '#f59e0b'}
        />
        <KpiCard
          label="High Withholding Events"
          value={dash.high_withholding_events}
          sub="Ratio > 40%"
          valueColor={dash.high_withholding_events > 3 ? '#ef4444' : '#f59e0b'}
        />
        <KpiCard
          label="Market Power Index"
          value={dash.market_power_index.toFixed(2)}
          unit="/ 10"
          sub="Derived from avg HHI"
          valueColor={dash.market_power_index >= 5 ? '#ef4444' : dash.market_power_index >= 3.5 ? '#f59e0b' : '#22c55e'}
        />
      </div>

      {/* Market Concentration */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-4">Market Concentration by Region</h2>
        <MarketConcentrationTable data={dash.market_concentration} />
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> HHI &lt;1500 Competitive</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> HHI 1500–2499 Moderately Concentrated</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> HHI &ge;2500 Highly Concentrated</span>
        </div>
      </div>

      {/* Withholding Records */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-4">Capacity Withholding Records</h2>
        <WithholdingTable data={dash.withholding_records} />
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> &lt;10% Low</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 10–24% Moderate</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &ge;25% High</span>
        </div>
      </div>

      {/* Rebid Patterns */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-1">Rebid Patterns (Jan–Jun 2024)</h2>
        <p className="text-xs text-gray-400 mb-4">
          Total rebids vs late rebids (&lt;5 min before dispatch) with market impact score overlay
        </p>
        <RebidPatternsChart data={dash.rebid_patterns} />
      </div>

      {/* Bid Price Distribution */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-base font-semibold text-white mb-1">Bid Price Distribution by Participant</h2>
        <p className="text-xs text-gray-400 mb-4">
          Volume offered (MW) and portfolio share (%) per price band — typical NEM bidding patterns
        </p>
        <PriceDistributionTable data={dash.price_distribution} />
      </div>
    </div>
  )
}
