// ---------------------------------------------------------------------------
// Sprint 45c — Renewable Energy Certificate Market Analytics (LGC & STC)
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import {
  Award,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Filter,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { api } from '../api/client'
import type { RecMarketDashboard, LgcSpotRecord, StcRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TECH_BADGE_STYLES: Record<string, string> = {
  WIND: 'bg-blue-900 text-blue-300 border border-blue-700',
  SOLAR: 'bg-amber-900 text-amber-300 border border-amber-700',
  HYDRO: 'bg-cyan-900 text-cyan-300 border border-cyan-700',
  BIOMASS: 'bg-green-900 text-green-300 border border-green-700',
  WASTE_COAL_MINE: 'bg-gray-700 text-gray-300 border border-gray-600',
  GEOTHERMAL: 'bg-orange-900 text-orange-300 border border-orange-700',
}

const TECH_LINE_COLORS: Record<string, string> = {
  WIND: '#60a5fa',
  SOLAR: '#fbbf24',
  HYDRO: '#22d3ee',
  BIOMASS: '#4ade80',
  WASTE_COAL_MINE: '#9ca3af',
  GEOTHERMAL: '#fb923c',
}

function TechBadge({ tech }: { tech: string }) {
  const cls = TECH_BADGE_STYLES[tech] ?? 'bg-gray-700 text-gray-300 border border-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {tech.replace('_', ' ')}
    </span>
  )
}

function fmtNum(n: number, decimals = 0) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtAud(n: number, decimals = 2) {
  return `$${fmtNum(n, decimals)}`
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string
  value: string
  sub?: string
  up?: boolean | null  // null = neutral
  icon?: React.ReactNode
}

function KpiCard({ label, value, sub, up, icon }: KpiProps) {
  const trendColor =
    up === null || up === undefined
      ? 'text-gray-400'
      : up
      ? 'text-green-400'
      : 'text-red-400'
  const TrendIcon = up ? TrendingUp : TrendingDown
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && (
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          {up !== null && up !== undefined && <TrendIcon size={12} />}
          <span>{sub}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LRET Progress Bar
// ---------------------------------------------------------------------------

function LretProgressBar({ progress, targetTwh }: { progress: number; targetTwh: number }) {
  const achieved = ((progress / 100) * targetTwh).toFixed(1)
  const remaining = (targetTwh - parseFloat(achieved)).toFixed(1)
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">
        LRET 2030 Target Progress — {targetTwh} TWh Annual Renewable Generation
      </h3>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg font-bold text-green-400">{progress.toFixed(1)}%</span>
        <span className="text-sm text-gray-400">of 33 TWh target</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-5 overflow-hidden">
        <div
          className="h-5 rounded-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-700"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>{achieved} TWh achieved (2024)</span>
        <span>{remaining} TWh remaining to 2030 target</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
        <div className="bg-gray-900 rounded p-3 text-center">
          <div className="text-green-400 font-bold text-base">{achieved} TWh</div>
          <div className="text-gray-500">Current generation</div>
        </div>
        <div className="bg-gray-900 rounded p-3 text-center">
          <div className="text-amber-400 font-bold text-base">{remaining} TWh</div>
          <div className="text-gray-500">Gap to 2030</div>
        </div>
        <div className="bg-gray-900 rounded p-3 text-center">
          <div className="text-blue-400 font-bold text-base">2030</div>
          <div className="text-gray-500">Compliance deadline</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LGC Spot Price Chart
// ---------------------------------------------------------------------------

function LgcSpotChart({ records }: { records: LgcSpotRecord[] }) {
  // Group by created_from to produce layered dataset
  const technologies = [...new Set(records.map(r => r.created_from))]

  // Build per-date map
  const dateMap: Record<string, Record<string, number | null>> = {}
  records.forEach(r => {
    if (!dateMap[r.trade_date]) {
      dateMap[r.trade_date] = {}
    }
    dateMap[r.trade_date][r.created_from] = r.spot_price_aud
  })

  const chartData = Object.entries(dateMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, vals]) => ({
      date: date.slice(5),  // "MM-DD"
      fullDate: date,
      ...vals,
    }))

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">
        LGC Spot Price History — Jan to Mar 2024 ($/certificate)
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
            formatter={(val: number, name: string) => [`$${val?.toFixed(2)}`, name]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {technologies.map(tech => (
            <Line
              key={tech}
              type="monotone"
              dataKey={tech}
              stroke={TECH_LINE_COLORS[tech] ?? '#a78bfa'}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STC Price Trend Chart
// ---------------------------------------------------------------------------

function StcPriceChart({ records }: { records: StcRecord[] }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">
        STC Quarterly Price & Volume Trend (2022–2024)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={records} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis
            yAxisId="price"
            orientation="left"
            domain={[35, 42]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={v => `$${v}`}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={v => `${(v / 1e6).toFixed(0)}M`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
            formatter={(val: number, name: string) => {
              if (name === 'STC Price ($/cert)') return [`$${val.toFixed(2)}`, name]
              return [`${(val / 1e6).toFixed(2)}M`, name]
            }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Bar yAxisId="volume" dataKey="volume_created" name="Volume Created" fill="#3b82f6" opacity={0.7} />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="stc_price_aud"
            name="STC Price ($/cert)"
            stroke="#fbbf24"
            strokeWidth={2}
            dot={{ fill: '#fbbf24', r: 3 }}
            // Line in BarChart — use as Line component
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2">
        Left axis: STC price ($/cert). Right axis: volume created.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LGC Creation Registry Table
// ---------------------------------------------------------------------------

const ALL_TECHS = ['ALL', 'WIND', 'SOLAR', 'HYDRO', 'BIOMASS', 'WASTE_COAL_MINE']

function LgcCreationTable({ dashboard }: { dashboard: RecMarketDashboard }) {
  const [techFilter, setTechFilter] = useState('ALL')
  const rows = dashboard.lgc_creation.filter(
    r => techFilter === 'ALL' || r.technology === techFilter
  )

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">LGC Creation Registry — Accredited Stations (2024)</h3>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={techFilter}
            onChange={e => setTechFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ALL_TECHS.map(t => (
              <option key={t} value={t}>{t === 'ALL' ? 'All Technologies' : t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Station</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Technology</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">State</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Capacity (MW)</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">LGCs Created</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">In Registry</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Avg Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.accreditation_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 text-gray-200 font-medium">{r.station_name}</td>
                <td className="py-2 px-3"><TechBadge tech={r.technology} /></td>
                <td className="py-2 px-3 text-gray-300">{r.state}</td>
                <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.capacity_mw, 0)}</td>
                <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.lgcs_created_2024)}</td>
                <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.lgcs_in_registry)}</td>
                <td className="py-2 px-3 text-right text-green-400 font-semibold">{fmtAud(r.avg_price_received)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-gray-500 py-6 text-sm">No stations match the selected filter.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compliance Table
// ---------------------------------------------------------------------------

function ComplianceTable({ dashboard }: { dashboard: RecMarketDashboard }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">
        LRET Liable Entity Compliance — 2024
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Entity</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Required LGCs</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Surrendered</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Shortfall</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Shortfall Charge ($M)</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Compliance %</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.surplus_deficit.map(r => {
              const isCompliant = r.shortfall_lgcs === 0
              return (
                <tr key={r.liable_entity} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-3 text-gray-200 font-medium flex items-center gap-2">
                    {isCompliant
                      ? <CheckCircle size={14} className="text-green-400 shrink-0" />
                      : <AlertTriangle size={14} className="text-amber-400 shrink-0" />}
                    {r.liable_entity}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.required_lgcs)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.surrendered_lgcs)}</td>
                  <td className={`py-2 px-3 text-right font-semibold ${r.shortfall_lgcs > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {r.shortfall_lgcs > 0 ? fmtNum(r.shortfall_lgcs) : '—'}
                  </td>
                  <td className={`py-2 px-3 text-right font-semibold ${r.shortfall_charge_m_aud > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {r.shortfall_charge_m_aud > 0 ? fmtAud(r.shortfall_charge_m_aud) + 'M' : '—'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      r.compliance_pct === 100
                        ? 'bg-green-900 text-green-300'
                        : r.compliance_pct >= 99
                        ? 'bg-amber-900 text-amber-300'
                        : 'bg-red-900 text-red-300'
                    }`}>
                      {r.compliance_pct.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STC Records Table
// ---------------------------------------------------------------------------

function StcTable({ records }: { records: StcRecord[] }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">STC Market — Quarterly Detail</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Quarter</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">STC Price</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Volume Created</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rooftop Solar (MW)</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Solar HW Units</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Heat Pumps</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Value ($M)</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.quarter} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 text-gray-200 font-semibold">{r.quarter}</td>
                <td className="py-2 px-3 text-right text-amber-400 font-bold">{fmtAud(r.stc_price_aud)}</td>
                <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.volume_created)}</td>
                <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.rooftop_solar_mw, 1)}</td>
                <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.solar_hot_water_units)}</td>
                <td className="py-2 px-3 text-right text-gray-300">{fmtNum(r.heat_pump_units)}</td>
                <td className="py-2 px-3 text-right text-green-400 font-semibold">{fmtAud(r.total_stc_value_m_aud, 1)}M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RecMarket() {
  const [dashboard, setDashboard] = useState<RecMarketDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showSpin = false) {
    if (showSpin) setRefreshing(true)
    try {
      const data = await api.getRecMarketDashboard()
      setDashboard(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load REC market data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center">
          <RefreshCw className="animate-spin text-green-400 mx-auto mb-3" size={32} />
          <p className="text-gray-400 text-sm">Loading REC market data...</p>
        </div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center max-w-md">
          <AlertTriangle className="text-amber-400 mx-auto mb-3" size={32} />
          <p className="text-gray-300 font-semibold mb-2">Failed to load data</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => load(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const surplusDeficitLabel = dashboard.lgc_surplus_deficit_m < 0
    ? `${Math.abs(dashboard.lgc_surplus_deficit_m).toFixed(1)}M deficit`
    : `${dashboard.lgc_surplus_deficit_m.toFixed(1)}M surplus`

  return (
    <div className="min-h-full bg-gray-900 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-900 rounded-lg">
            <Award className="text-green-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Renewable Energy Certificate Market (LGC &amp; STC)
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Large-scale Generation Certificates, Small-scale Technology Certificates,
              LRET &amp; SRES compliance, and certificate price analytics
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Current LGC Price"
          value={fmtAud(dashboard.current_lgc_price) + '/cert'}
          sub="Large-scale Generation Certificate"
          up={null}
          icon={<Award size={16} />}
        />
        <KpiCard
          label="Current STC Price"
          value={fmtAud(dashboard.current_stc_price) + '/cert'}
          sub="Small-scale Technology Certificate"
          up={null}
          icon={<Award size={16} />}
        />
        <KpiCard
          label="LRET Progress"
          value={`${dashboard.lret_progress_pct.toFixed(1)}%`}
          sub={`Toward ${dashboard.lret_target_2030_twh} TWh 2030 target`}
          up={dashboard.lret_progress_pct >= 65}
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="LGC Surplus / Deficit"
          value={surplusDeficitLabel}
          sub={dashboard.lgc_surplus_deficit_m < 0 ? 'Below compliance threshold' : 'Above compliance threshold'}
          up={dashboard.lgc_surplus_deficit_m >= 0}
          icon={dashboard.lgc_surplus_deficit_m >= 0
            ? <TrendingUp size={16} />
            : <TrendingDown size={16} />}
        />
      </div>

      {/* LGC Price Chart + LRET Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <LgcSpotChart records={dashboard.lgc_spot_records} />
        <LretProgressBar
          progress={dashboard.lret_progress_pct}
          targetTwh={dashboard.lret_target_2030_twh}
        />
      </div>

      {/* LGC Creation Registry */}
      <div className="mb-6">
        <LgcCreationTable dashboard={dashboard} />
      </div>

      {/* Compliance Table */}
      <div className="mb-6">
        <ComplianceTable dashboard={dashboard} />
      </div>

      {/* STC Market Section */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-amber-400 rounded-full" />
          <h2 className="text-base font-semibold text-white">
            Small-scale Renewable Energy Scheme (SRES) — STC Market
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StcPriceChart records={dashboard.stc_records} />
          <StcTable records={dashboard.stc_records} />
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-600 mt-6">
        Data sourced from Clean Energy Regulator (CER) registry. LGC prices are indicative spot market prices.
        STC clearing house price capped at $40/certificate. Last updated: {dashboard.timestamp}
      </p>
    </div>
  )
}
