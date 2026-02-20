import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Activity, AlertTriangle, TrendingUp, Zap, BarChart2, List } from 'lucide-react'
import {
  getSpotPriceVolatilityRegimeDashboard,
  SVRDashboard,
  SVRRegimeRecord,
  SVRVolatilityMetric,
  SVRSpikeCluster,
  SVRTransitionMatrix,
  SVRRegimeDriver,
} from '../api/client'

// ── Colour helpers ──────────────────────────────────────────────────────────
const REGIME_COLOUR: Record<string, string> = {
  LOW_VOL: '#22c55e',
  NORMAL:  '#3b82f6',
  HIGH_VOL:'#f59e0b',
  EXTREME: '#ef4444',
}

const REGION_COLOUR: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#34d399',
  VIC1: '#a78bfa',
  SA1:  '#fb923c',
  TAS1: '#f472b6',
}

const CAUSE_COLOUR: Record<string, string> = {
  LOW_WIND:          '#f59e0b',
  HIGH_DEMAND:       '#ef4444',
  CONSTRAINT:        '#a78bfa',
  OUTAGE:            '#fb923c',
  STRATEGIC_BIDDING: '#ec4899',
}

const SIG_BADGE: Record<string, string> = {
  HIGH:   'bg-red-900 text-red-200',
  MEDIUM: 'bg-yellow-900 text-yellow-200',
  LOW:    'bg-gray-700 text-gray-300',
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, Icon, colour,
}: {
  label: string; value: string | number; sub?: string; Icon: React.ElementType; colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-start gap-3 shadow">
      <div className={`p-2 rounded-lg ${colour}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Regime Timeline ─────────────────────────────────────────────────────────
function RegimeTimeline({ regimes }: { regimes: SVRRegimeRecord[] }) {
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const byRegion: Record<string, SVRRegimeRecord[]> = {}
  regions.forEach(r => { byRegion[r] = regimes.filter(x => x.region === r) })

  const chartData = regions.flatMap(region =>
    byRegion[region].map(rec => ({
      region,
      regime: rec.regime,
      duration: rec.duration_days,
      mean: rec.mean_price,
      label: `${rec.start_date} → ${rec.end_date}`,
    }))
  )

  // Aggregate avg duration by regime for bar chart
  const durationByRegime: Record<string, { total: number; count: number }> = {}
  regimes.forEach(r => {
    if (!durationByRegime[r.regime]) durationByRegime[r.regime] = { total: 0, count: 0 }
    durationByRegime[r.regime].total += r.duration_days
    durationByRegime[r.regime].count += 1
  })
  const barData = Object.entries(durationByRegime).map(([regime, { total, count }]) => ({
    regime,
    avg_duration: Math.round(total / count),
    colour: REGIME_COLOUR[regime] ?? '#94a3b8',
  }))

  return (
    <section className="bg-gray-800 rounded-xl p-5 shadow">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={18} className="text-blue-400" />
        <h2 className="text-lg font-semibold text-white">Regime Timeline &amp; Duration</h2>
      </div>

      {/* Regime grid per region */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3">Region</th>
              <th className="text-left py-2 pr-3">Regime</th>
              <th className="text-left py-2 pr-3">Start</th>
              <th className="text-left py-2 pr-3">End</th>
              <th className="text-right py-2 pr-3">Days</th>
              <th className="text-right py-2 pr-3">Mean $/MWh</th>
              <th className="text-right py-2 pr-3">Std</th>
              <th className="text-right py-2 pr-3">Max</th>
              <th className="text-right py-2 pr-3">Spikes</th>
              <th className="text-right py-2">Negatives</th>
            </tr>
          </thead>
          <tbody>
            {regimes.map((r, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-1.5 pr-3">
                  <span className="font-mono" style={{ color: REGION_COLOUR[r.region] ?? '#fff' }}>{r.region}</span>
                </td>
                <td className="py-1.5 pr-3">
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-semibold"
                    style={{ background: REGIME_COLOUR[r.regime] + '33', color: REGIME_COLOUR[r.regime] }}
                  >
                    {r.regime}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-gray-300">{r.start_date}</td>
                <td className="py-1.5 pr-3 text-gray-300">{r.end_date}</td>
                <td className="py-1.5 pr-3 text-right text-gray-200">{r.duration_days}</td>
                <td className="py-1.5 pr-3 text-right text-gray-200">{r.mean_price.toFixed(1)}</td>
                <td className="py-1.5 pr-3 text-right text-gray-400">{r.std_price.toFixed(1)}</td>
                <td className="py-1.5 pr-3 text-right" style={{ color: r.max_price > 5000 ? '#ef4444' : '#f59e0b' }}>
                  {r.max_price.toFixed(0)}
                </td>
                <td className="py-1.5 pr-3 text-right text-orange-400">{r.spike_count.toLocaleString()}</td>
                <td className="py-1.5 text-right text-purple-400">{r.negative_count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Average duration by regime */}
      <div>
        <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Average Duration by Regime (days)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="regime" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="avg_duration" name="Avg Duration (days)" radius={[4, 4, 0, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.colour} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

// ── Volatility Metrics ──────────────────────────────────────────────────────
function VolatilityMetricsSection({ metrics }: { metrics: SVRVolatilityMetric[] }) {
  const quarters = [...new Set(metrics.map(m => m.quarter))].sort()
  const regions  = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']

  // Line chart: realized vol by region over quarters
  const lineData = quarters.map(q => {
    const row: Record<string, unknown> = { quarter: q }
    regions.forEach(r => {
      const m = metrics.find(x => x.region === r && x.quarter === q)
      if (m) row[r] = m.realized_volatility_annualized
    })
    return row
  })

  // Table view for CVaR
  return (
    <section className="bg-gray-800 rounded-xl p-5 shadow">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-green-400" />
        <h2 className="text-lg font-semibold text-white">Volatility Metrics — Realized Vol by Region</h2>
      </div>

      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Annualized Realized Volatility (2023-Q1 to 2024-Q4)</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={lineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {regions.map(r => (
              <Line
                key={r}
                type="monotone"
                dataKey={r}
                stroke={REGION_COLOUR[r]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CVaR Table */}
      <div>
        <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Conditional VaR Summary (latest quarter per region)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3">Region</th>
                <th className="text-left py-2 pr-3">Quarter</th>
                <th className="text-right py-2 pr-3">RV Annualized</th>
                <th className="text-right py-2 pr-3">GARCH Vol</th>
                <th className="text-right py-2 pr-3">CVaR 95%</th>
                <th className="text-right py-2 pr-3">CVaR 99%</th>
                <th className="text-right py-2 pr-3">Price Range %</th>
                <th className="text-right py-2">IQR $/MWh</th>
              </tr>
            </thead>
            <tbody>
              {metrics
                .filter(m => m.quarter === '2024-Q4')
                .map((m, i) => (
                  <tr key={i} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="py-1.5 pr-3 font-mono" style={{ color: REGION_COLOUR[m.region] ?? '#fff' }}>{m.region}</td>
                    <td className="py-1.5 pr-3 text-gray-300">{m.quarter}</td>
                    <td className="py-1.5 pr-3 text-right text-blue-300">{m.realized_volatility_annualized.toFixed(3)}</td>
                    <td className="py-1.5 pr-3 text-right text-purple-300">{m.garch_volatility.toFixed(3)}</td>
                    <td className="py-1.5 pr-3 text-right text-yellow-300">{m.conditional_var_95.toFixed(1)}</td>
                    <td className="py-1.5 pr-3 text-right text-orange-400">{m.conditional_var_99.toFixed(1)}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-200">{m.price_range_pct.toFixed(1)}%</td>
                    <td className="py-1.5 text-right text-gray-200">{m.iqr_price.toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ── Transition Matrix Heatmap ───────────────────────────────────────────────
function TransitionMatrixSection({ matrix }: { matrix: SVRTransitionMatrix[] }) {
  const regimes = ['LOW_VOL', 'NORMAL', 'HIGH_VOL', 'EXTREME']

  const get = (from: string, to: string) =>
    matrix.find(m => m.from_regime === from && m.to_regime === to)

  const cellBg = (prob: number) => {
    if (prob >= 0.6) return 'bg-red-900'
    if (prob >= 0.35) return 'bg-orange-900'
    if (prob >= 0.15) return 'bg-yellow-900'
    return 'bg-gray-700'
  }

  return (
    <section className="bg-gray-800 rounded-xl p-5 shadow">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={18} className="text-purple-400" />
        <h2 className="text-lg font-semibold text-white">Regime Transition Matrix</h2>
        <span className="text-xs text-gray-400 ml-2">(probability of moving from row regime to column regime)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-gray-400 text-left">From \ To</th>
              {regimes.map(r => (
                <th key={r} className="px-3 py-2 text-center font-semibold" style={{ color: REGIME_COLOUR[r] }}>
                  {r}
                </th>
              ))}
              <th className="px-3 py-2 text-gray-400 text-center">Avg Duration (days)</th>
            </tr>
          </thead>
          <tbody>
            {regimes.map(from => (
              <tr key={from} className="border-t border-gray-700">
                <td className="px-3 py-2 font-semibold" style={{ color: REGIME_COLOUR[from] }}>
                  {from}
                </td>
                {regimes.map(to => {
                  const entry = get(from, to)
                  const prob = entry?.transition_probability ?? 0
                  return (
                    <td
                      key={to}
                      className={`px-3 py-2 text-center font-mono rounded ${cellBg(prob)}`}
                      title={entry ? `Avg ${entry.avg_duration_days} days` : ''}
                    >
                      <span className={prob >= 0.35 ? 'text-white font-bold' : 'text-gray-300'}>
                        {(prob * 100).toFixed(0)}%
                      </span>
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-center text-gray-300">
                  {get(from, from)?.avg_duration_days?.toFixed(1) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900 inline-block" /> &ge;60%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-900 inline-block" /> 35-59%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-900 inline-block" /> 15-34%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-700 inline-block" /> &lt;15%</span>
      </div>
    </section>
  )
}

// ── Spike Clusters ──────────────────────────────────────────────────────────
function SpikeClustersSection({ clusters }: { clusters: SVRSpikeCluster[] }) {
  const barData = clusters.map(c => ({
    id: `#${c.cluster_id} ${c.region}`,
    peak_price: c.peak_price,
    total_cost: c.total_cost_m,
    cause: c.primary_cause,
    colour: CAUSE_COLOUR[c.primary_cause] ?? '#94a3b8',
  }))

  return (
    <section className="bg-gray-800 rounded-xl p-5 shadow">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={18} className="text-yellow-400" />
        <h2 className="text-lg font-semibold text-white">Price Spike Clusters</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3">#</th>
                <th className="text-left py-2 pr-3">Region</th>
                <th className="text-left py-2 pr-3">Start</th>
                <th className="text-right py-2 pr-3">Intervals</th>
                <th className="text-right py-2 pr-3">Peak $/MWh</th>
                <th className="text-right py-2 pr-3">Cost $M</th>
                <th className="text-left py-2">Cause</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map(c => (
                <tr key={c.cluster_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-1.5 pr-3 text-gray-400">{c.cluster_id}</td>
                  <td className="py-1.5 pr-3 font-mono" style={{ color: REGION_COLOUR[c.region] ?? '#fff' }}>{c.region}</td>
                  <td className="py-1.5 pr-3 text-gray-300">{c.start_datetime.replace('T', ' ')}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-200">{c.duration_intervals}</td>
                  <td className="py-1.5 pr-3 text-right font-bold" style={{ color: c.peak_price >= 10000 ? '#ef4444' : '#f59e0b' }}>
                    {c.peak_price >= 1000 ? `${(c.peak_price / 1000).toFixed(1)}k` : c.peak_price.toFixed(0)}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-orange-400">{c.total_cost_m.toFixed(1)}</td>
                  <td className="py-1.5">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{ background: (CAUSE_COLOUR[c.primary_cause] ?? '#94a3b8') + '33', color: CAUSE_COLOUR[c.primary_cause] ?? '#fff' }}
                    >
                      {c.primary_cause.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bar chart: peak price */}
        <div>
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Peak Price by Cluster ($/MWh)</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis dataKey="id" type="category" width={100} tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number) => [`$${v.toLocaleString()}/MWh`, 'Peak Price']}
              />
              <Bar dataKey="peak_price" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.colour} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

// ── Regime Drivers ──────────────────────────────────────────────────────────
function RegimeDriversSection({ drivers }: { drivers: SVRRegimeDriver[] }) {
  const regimes = ['LOW_VOL', 'NORMAL', 'HIGH_VOL', 'EXTREME']

  return (
    <section className="bg-gray-800 rounded-xl p-5 shadow">
      <div className="flex items-center gap-2 mb-4">
        <List size={18} className="text-pink-400" />
        <h2 className="text-lg font-semibold text-white">Regime Drivers &amp; Correlations</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {regimes.map(regime => {
          const regimeDrivers = drivers.filter(d => d.regime === regime)
          return (
            <div key={regime} className="bg-gray-900 rounded-lg p-4">
              <h3 className="text-sm font-bold mb-3" style={{ color: REGIME_COLOUR[regime] }}>
                {regime}
              </h3>
              <div className="space-y-2">
                {regimeDrivers.map((d, i) => {
                  const pct = Math.abs(d.correlation) * 100
                  const isPos = d.correlation >= 0
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-300 truncate pr-2" title={d.driver}>
                          {d.driver.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={isPos ? 'text-green-400' : 'text-red-400'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {isPos ? '+' : ''}{d.correlation.toFixed(2)}
                          </span>
                          <span className={`px-1 py-0.5 rounded text-xs ${SIG_BADGE[d.significance]}`}>
                            {d.significance[0]}
                          </span>
                        </div>
                      </div>
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isPos ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function SpotPriceVolatilityRegimeAnalytics() {
  const [data, setData] = useState<SVRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getSpotPriceVolatilityRegimeDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Activity size={36} className="text-blue-400 mx-auto animate-pulse" />
          <p className="text-gray-300 text-sm">Loading Volatility Regime Analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 max-w-md text-center space-y-2">
          <AlertTriangle size={28} className="text-red-400 mx-auto" />
          <p className="text-red-300 font-semibold">Failed to load dashboard</p>
          <p className="text-red-400 text-xs font-mono">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const s = data.summary as Record<string, unknown>

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <Activity size={24} className="text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Spot Price Volatility Regime Analytics</h1>
            <p className="text-xs text-gray-400 mt-0.5">NEM Volatility Regime Classification, Spike Cluster Detection &amp; Driver Attribution</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <KpiCard
            label="Regimes Identified"
            value={String(s.total_regimes_identified ?? data.regimes.length)}
            sub="across 5 NEM regions"
            Icon={BarChart2}
            colour="bg-blue-700"
          />
          <KpiCard
            label="Extreme Regime %"
            value={`${s.extreme_regime_pct ?? '—'}%`}
            sub="of total regime time"
            Icon={AlertTriangle}
            colour="bg-red-700"
          />
          <KpiCard
            label="Avg Spike Duration"
            value={`${s.avg_spike_duration_hrs ?? '—'} hrs`}
            sub="per spike cluster"
            Icon={Zap}
            colour="bg-yellow-700"
          />
          <KpiCard
            label="Most Volatile Region"
            value={String(s.most_volatile_region ?? '—')}
            sub="highest annualized vol"
            Icon={TrendingUp}
            colour="bg-orange-700"
          />
          <KpiCard
            label="Regime Persistence"
            value={`${s.regime_persistence_avg_days ?? '—'} days`}
            sub="average regime duration"
            Icon={Activity}
            colour="bg-purple-700"
          />
        </div>

        {/* Sections */}
        <RegimeTimeline regimes={data.regimes} />
        <VolatilityMetricsSection metrics={data.volatility_metrics} />
        <TransitionMatrixSection matrix={data.transition_matrix} />
        <SpikeClustersSection clusters={data.spike_clusters} />
        <RegimeDriversSection drivers={data.regime_drivers} />
      </div>
    </div>
  )
}
