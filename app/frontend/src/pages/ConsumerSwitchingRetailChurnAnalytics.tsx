import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from 'recharts'
import {
  getConsumerSwitchingRetailChurnDashboard,
  CSRDashboard,
  CSRSwitchingRateRecord,
  CSRChurnDriverRecord,
  CSRCompetitivePressureRecord,
} from '../api/client'

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt1 = (n: number): string => n.toFixed(1)
const fmt0 = (n: number): string => n.toFixed(0)

const REGION_COLORS: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#34d399',
  VIC1: '#f59e0b',
  SA1:  '#f87171',
  TAS1: '#a78bfa',
}

const TREND_BADGE: Record<string, string> = {
  INCREASING: 'bg-red-700 text-red-100',
  STABLE:     'bg-yellow-700 text-yellow-100',
  DECREASING: 'bg-green-700 text-green-100',
}

const SEGMENT_BADGE: Record<string, string> = {
  RESIDENTIAL:    'bg-blue-700 text-blue-100',
  SME:            'bg-teal-700 text-teal-100',
  LARGE_COMMERCIAL: 'bg-purple-700 text-purple-100',
}

const Badge = ({ label, cls }: { label: string; cls: string }) => (
  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${cls}`}>
    {label.replace(/_/g, ' ')}
  </span>
)

interface KpiProps { label: string; value: string; sub?: string }
const KpiCard = ({ label, value, sub }: KpiProps) => (
  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
    <p className="text-2xl font-bold text-white">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
)

// ─── switching rate trend data builder ──────────────────────────────────────

interface QuarterPoint {
  quarter: string
  [region: string]: string | number
}

function buildSwitchingTrend(records: CSRSwitchingRateRecord[]): QuarterPoint[] {
  const map: Record<string, Record<string, number[]>> = {}
  for (const r of records) {
    if (!map[r.quarter]) map[r.quarter] = {}
    if (!map[r.quarter][r.region]) map[r.quarter][r.region] = []
    map[r.quarter][r.region].push(r.switching_rate_pct)
  }
  const quarters = Object.keys(map).sort()
  return quarters.map(q => {
    const point: QuarterPoint = { quarter: q }
    for (const [region, vals] of Object.entries(map[q])) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      point[region] = parseFloat(avg.toFixed(2))
    }
    return point
  })
}

// ─── churn driver chart data ─────────────────────────────────────────────────

function buildDriverData(drivers: CSRChurnDriverRecord[]) {
  return [...drivers]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 8)
    .map(d => ({ name: d.driver.length > 22 ? d.driver.slice(0, 22) + '…' : d.driver, impact: d.impact_score, frequency: d.frequency_pct }))
}

// ─── competitive pressure radar data ─────────────────────────────────────────

function buildRadarData(pressures: CSRCompetitivePressureRecord[]) {
  return pressures.map(p => ({
    region: p.region,
    'Price Dispersion': p.price_dispersion_pct,
    'Offer Count (scaled)': Math.min(p.offer_count / 3, 50),
    'Competitors': p.effective_competitors * 2.5,
    'Saving Potential (scaled)': p.best_vs_worst_saving_aud / 16,
  }))
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function ConsumerSwitchingRetailChurnAnalytics() {
  const [data, setData] = useState<CSRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getConsumerSwitchingRetailChurnDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <p className="text-gray-400 animate-pulse">Loading consumer switching analytics…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <p className="text-red-400">Error loading data: {error ?? 'unknown'}</p>
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>
  const trendData   = buildSwitchingTrend(data.switching_rates)
  const driverData  = buildDriverData(data.churn_drivers)
  const radarData   = buildRadarData(data.competitive_pressures)
  const regions     = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  // retailer market share — top 6 by average share across regions
  const retailerAvg: Record<string, number[]> = {}
  for (const rs of data.retailer_shares) {
    if (!retailerAvg[rs.retailer]) retailerAvg[rs.retailer] = []
    retailerAvg[rs.retailer].push(rs.market_share_pct)
  }
  const retailerBarData = Object.entries(retailerAvg)
    .map(([retailer, vals]) => ({
      retailer: retailer.length > 18 ? retailer.slice(0, 18) + '…' : retailer,
      avg_share: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
    }))
    .sort((a, b) => b.avg_share - a.avg_share)
    .slice(0, 8)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">

      {/* ── page header ── */}
      <div className="flex items-center gap-3">
        <Users className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Consumer Switching &amp; Retail Churn Analytics</h1>
          <p className="text-gray-400 text-sm">NEM electricity retailer switching, churn drivers and competitive market dynamics</p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="National Avg Switching Rate"
          value={`${summary.national_avg_switching_rate_pct}%`}
          sub={`YoY change: +${summary.yoy_switching_change_pct}%`}
        />
        <KpiCard
          label="Most Competitive Region"
          value={String(summary.most_competitive_region)}
          sub="By effective competitor count"
        />
        <KpiCard
          label="Avg Saving on Switch"
          value={`$${summary.avg_saving_on_switch_aud}`}
          sub="Annual household benefit"
        />
        <KpiCard
          label="Digital Switching"
          value={`${summary.digital_switching_pct}%`}
          sub="Via online / app channel"
        />
      </div>

      {/* ── row 1: switching rate trend & retailer market share ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* switching rate trend by region */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Switching Rate Trend by Region (%)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {regions.map(r => (
                <Line
                  key={r}
                  type="monotone"
                  dataKey={r}
                  stroke={REGION_COLORS[r]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* retailer market share */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Retailer Avg Market Share (top 8)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={retailerBarData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="retailer" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Bar dataKey="avg_share" name="Avg Share %" radius={[4, 4, 0, 0]}>
                {retailerBarData.map((_, i) => (
                  <Cell key={i} fill={['#60a5fa','#34d399','#f59e0b','#f87171','#a78bfa','#fb923c','#38bdf8','#4ade80'][i % 8]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── row 2: churn drivers & competitive pressure ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* top churn drivers — horizontal bar */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Top Churn Drivers by Impact Score</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              layout="vertical"
              data={driverData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 10]} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} width={140} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="impact" name="Impact Score" fill="#60a5fa" radius={[0, 4, 4, 0]} />
              <Bar dataKey="frequency" name="Frequency %" fill="#34d399" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* competitive pressure radar */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Competitive Pressure by Region</h2>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Radar name="Price Dispersion" dataKey="Price Dispersion" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.15} />
              <Radar name="Offer Count" dataKey="Offer Count (scaled)" stroke="#34d399" fill="#34d399" fillOpacity={0.15} />
              <Radar name="Competitors" dataKey="Competitors" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
              <Radar name="Saving Potential" dataKey="Saving Potential (scaled)" stroke="#f87171" fill="#f87171" fillOpacity={0.15} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f3f4f6' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── row 3: switching friction barriers table ── */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Switching Friction Barriers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-left">
                <th className="pb-2 pr-4">Barrier</th>
                <th className="pb-2 pr-4">Severity</th>
                <th className="pb-2 pr-4">Affected %</th>
                <th className="pb-2 pr-4">Avg Delay (days)</th>
                <th className="pb-2 pr-4">Policy Response</th>
                <th className="pb-2">Resolved %</th>
              </tr>
            </thead>
            <tbody>
              {data.switching_frictions.map((f, i) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-gray-100 font-medium">{f.barrier}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-orange-400"
                          style={{ width: `${(f.severity_score / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-300 text-xs">{fmt1(f.severity_score)}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{fmt1(f.affected_pct)}%</td>
                  <td className="py-2 pr-4 text-gray-300">{fmt1(f.avg_delay_days)}</td>
                  <td className="py-2 pr-4">
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                      {f.policy_response}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-green-400"
                          style={{ width: `${f.resolved_pct}%` }}
                        />
                      </div>
                      <span className="text-gray-300 text-xs">{fmt1(f.resolved_pct)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── row 4: churn drivers detail table ── */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Churn Driver Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-left">
                <th className="pb-2 pr-4">Rank</th>
                <th className="pb-2 pr-4">Driver</th>
                <th className="pb-2 pr-4">Impact Score</th>
                <th className="pb-2 pr-4">Segment</th>
                <th className="pb-2 pr-4">Frequency %</th>
                <th className="pb-2">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.churn_drivers.map((d, i) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-gray-400 font-mono">#{d.rank}</td>
                  <td className="py-2 pr-4 text-gray-100 font-medium">{d.driver}</td>
                  <td className="py-2 pr-4">
                    <span className="text-white font-semibold">{fmt1(d.impact_score)}</span>
                    <span className="text-gray-500">/10</span>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={d.segment} cls={SEGMENT_BADGE[d.segment] ?? 'bg-gray-700 text-gray-100'} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{fmt1(d.frequency_pct)}%</td>
                  <td className="py-2">
                    <Badge label={d.trend} cls={TREND_BADGE[d.trend] ?? 'bg-gray-700 text-gray-100'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── row 5: competitive pressure table ── */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Regional Competitive Pressure</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700 text-left">
                <th className="pb-2 pr-4">Region</th>
                <th className="pb-2 pr-4">HHI Index</th>
                <th className="pb-2 pr-4">Effective Competitors</th>
                <th className="pb-2 pr-4">Price Dispersion %</th>
                <th className="pb-2 pr-4">Offers</th>
                <th className="pb-2">Best vs Worst Saving ($)</th>
              </tr>
            </thead>
            <tbody>
              {data.competitive_pressures.map((p, i) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: `${REGION_COLORS[p.region]}22`, color: REGION_COLORS[p.region] }}
                    >
                      {p.region}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{fmt0(p.hhi_index)}</td>
                  <td className="py-2 pr-4 text-white font-semibold">{p.effective_competitors}</td>
                  <td className="py-2 pr-4 text-gray-300">{fmt1(p.price_dispersion_pct)}%</td>
                  <td className="py-2 pr-4 text-gray-300">{p.offer_count}</td>
                  <td className="py-2 text-green-400 font-semibold">${fmt0(p.best_vs_worst_saving_aud)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
