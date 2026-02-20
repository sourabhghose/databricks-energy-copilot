// ============================================================
// Sprint 54c — REC & PPAs Tracking (Australian RET Scheme)
// LGCs, STCs, GreenPower, and corporate renewable matching
// ============================================================

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
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
import { Award, Leaf, BadgeCheck, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { getRecCertificateDashboard, RecCertificateDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Types (mirrored from API for local use)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtAud(val: number, decimals = 2): string {
  return `$${val.toFixed(decimals)}`
}

function fmtK(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}M`
  return `${val.toFixed(0)}k`
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    COMPLIANT: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
    SHORTFALL: 'bg-red-500/20 text-red-400 border border-red-500/40',
    DEFERRED:  'bg-amber-500/20 text-amber-400 border border-amber-500/40',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${cfg[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {status === 'COMPLIANT' && <CheckCircle className="w-3 h-3" />}
      {status === 'SHORTFALL' && <AlertTriangle className="w-3 h-3" />}
      {status === 'DEFERRED'  && <TrendingUp className="w-3 h-3" />}
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ title, value, subtitle, icon, accent }: KpiCardProps) {
  return (
    <div className={`bg-gray-800 rounded-xl p-5 border border-gray-700 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">{title}</span>
        <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LGC Price Trend Chart
// ---------------------------------------------------------------------------

function LgcPriceChart({ data }: { data: RecCertificateDashboard['lgc_prices'] }) {
  const chartData = data.map(d => ({
    month: d.month.slice(2),  // "23-01" short label
    spot:   d.lgc_spot_price_aud,
    fwd26:  d.lgc_forward_2026_aud,
    fwd27:  d.lgc_forward_2027_aud,
    vol:    d.volume_k_certificates,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">LGC Price Trend — Spot &amp; Forward Curves</h3>
      <p className="text-gray-500 text-xs mb-4">Monthly spot price vs 2026/2027 forward curves (AUD/certificate)</p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="spotGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} interval={2} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[48, 82]} unit=" $" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v: number, name: string) => [
              `$${v.toFixed(2)}`,
              name === 'spot' ? 'Spot' : name === 'fwd26' ? 'Forward 2026' : 'Forward 2027',
            ]}
          />
          <Legend
            formatter={(v) => v === 'spot' ? 'Spot Price' : v === 'fwd26' ? 'Forward 2026' : 'Forward 2027'}
            wrapperStyle={{ color: '#9ca3af', fontSize: 12 }}
          />
          <Area type="monotone" dataKey="spot"  stroke="#10b981" fill="url(#spotGrad)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="fwd26" stroke="#3b82f6" fill="none" strokeWidth={2} strokeDasharray="5 3" dot={false} />
          <Area type="monotone" dataKey="fwd27" stroke="#a78bfa" fill="none" strokeWidth={2} strokeDasharray="8 4" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LRET Surplus/Deficit Bar Chart
// ---------------------------------------------------------------------------

function SurplusDeficitChart({ data }: { data: RecCertificateDashboard['surplus_deficit'] }) {
  const chartData = data.map(d => ({
    year: d.year.toString(),
    value: d.surplus_deficit_gwh,
    target: d.lret_target_gwh,
    surrenders: d.liable_entity_surrenders_gwh,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">LRET Annual Surplus / Deficit</h3>
      <p className="text-gray-500 text-xs mb-4">GWh above (surplus) or below (deficit) the 33,000 GWh LRET target</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" GWh" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v: number) => [`${v.toFixed(0)} GWh`]}
          />
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" />
          <Bar
            dataKey="value"
            name="Surplus / Deficit"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
            // Colour each bar based on sign
            label={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LGC Creation by Technology Stacked Bar Chart
// ---------------------------------------------------------------------------

function CreationByTechChart({ data }: { data: RecCertificateDashboard['creation'] }) {
  const regions = ['NSW1', 'VIC1', 'QLD1', 'SA1', 'TAS1']
  const techs = Array.from(new Set(data.map(d => d.technology)))
  const COLORS: Record<string, string> = {
    'Wind':          '#3b82f6',
    'Large Solar':   '#f59e0b',
    'Hydro':         '#06b6d4',
    'Biomass/Waste': '#84cc16',
    'Rooftop Solar': '#f97316',
  }

  // Build per-region aggregation
  const chartData = regions.map(region => {
    const row: Record<string, string | number> = { region }
    techs.forEach(tech => {
      const match = data.find(d => d.region === region && d.technology === tech)
      row[tech] = match?.lgcs_created_k ?? 0
    })
    return row
  }).filter(r => techs.some(t => (r[t] as number) > 0))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">LGC Creation by Technology &amp; Region (2024)</h3>
      <p className="text-gray-500 text-xs mb-4">Thousands of certificates created per NEM region by technology type</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="k" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f9fafb' }}
            formatter={(v: number, name: string) => [`${v.toLocaleString()}k certificates`, name]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {techs.map(tech => (
            <Bar key={tech} dataKey={tech} stackId="a" fill={COLORS[tech] ?? '#6b7280'} radius={tech === techs[techs.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Retailer Compliance Table
// ---------------------------------------------------------------------------

function ComplianceTable({ data }: { data: RecCertificateDashboard['compliance'] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">Retailer Compliance — 2024 Surrender Year</h3>
      <p className="text-gray-500 text-xs mb-4">LRET liable entity surrender obligations and compliance status</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 font-medium py-2 pr-4">Retailer</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-4">Market Share</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-4">Liable Energy (GWh)</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-4">Certs Surrendered (k)</th>
              <th className="text-center text-gray-400 font-medium py-2 pr-4">Status</th>
              <th className="text-right text-gray-400 font-medium py-2">Shortfall Charge ($M)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="text-white font-medium py-2.5 pr-4">{row.retailer}</td>
                <td className="text-gray-300 text-right pr-4">{row.market_share_pct.toFixed(1)}%</td>
                <td className="text-gray-300 text-right pr-4">{row.liable_energy_gwh.toLocaleString()}</td>
                <td className="text-gray-300 text-right pr-4">{row.certificates_surrendered_k.toLocaleString()}</td>
                <td className="text-center pr-4">
                  <StatusBadge status={row.compliance_status} />
                </td>
                <td className="text-right">
                  {row.shortfall_charge_m_aud > 0
                    ? <span className="text-red-400 font-semibold">${row.shortfall_charge_m_aud.toFixed(1)}M</span>
                    : <span className="text-gray-500">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GreenPower State Table
// ---------------------------------------------------------------------------

function GreenPowerTable({ data }: { data: RecCertificateDashboard['greenpower'] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-semibold mb-1">GreenPower by State — 2024</h3>
      <p className="text-gray-500 text-xs mb-4">Accredited GreenPower customers, consumption, premiums and year-on-year growth</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 font-medium py-2 pr-4">State</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-4">Customers (k)</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-4">GreenPower (GWh)</th>
              <th className="text-right text-gray-400 font-medium py-2 pr-4">Avg Premium ($/MWh)</th>
              <th className="text-right text-gray-400 font-medium py-2">YoY Growth</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="py-2.5 pr-4">
                  <span className="inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-bold">{row.state}</span>
                </td>
                <td className="text-gray-300 text-right pr-4">{row.greenpower_customers_k.toLocaleString()}</td>
                <td className="text-gray-300 text-right pr-4">{row.greenpower_gwh.toLocaleString()}</td>
                <td className="text-gray-300 text-right pr-4">${row.avg_premium_aud_mwh.toFixed(2)}</td>
                <td className="text-right">
                  <span className={`font-semibold ${row.yoy_growth_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {row.yoy_growth_pct >= 0 ? '+' : ''}{row.yoy_growth_pct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function RecCertificateTracking() {
  const [data, setData] = useState<RecCertificateDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRecCertificateDashboard()
      .then(setData)
      .catch((err) => setError(err.message ?? 'Failed to load REC dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3" />
        Loading REC Certificate Dashboard...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="w-6 h-6 mr-2" />
        {error ?? 'No data available'}
      </div>
    )
  }

  // KPI computations
  const latestLgc = data.lgc_prices[data.lgc_prices.length - 1]
  const latest2024 = data.surplus_deficit.find(d => d.year === 2024)
  const totalLgcsCreated = data.creation.reduce((s, d) => s + d.lgcs_created_k, 0)
  const totalGreenPowerCustomers = data.greenpower.reduce((s, d) => s + d.greenpower_customers_k, 0)

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
          <Award className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">REC &amp; PPAs Certificate Tracking</h1>
          <p className="text-gray-400 text-sm">Australian RET Scheme — LGCs, STCs, GreenPower &amp; Corporate Renewable Matching</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <Leaf className="w-4 h-4 text-emerald-500" />
          <span>LRET: 33,000 GWh target</span>
          <span className="mx-1">|</span>
          <BadgeCheck className="w-4 h-4 text-blue-400" />
          <span>Data: CY2024</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="LGC Spot Price (Dec 2024)"
          value={fmtAud(latestLgc.lgc_spot_price_aud)}
          subtitle={`Fwd 2026: ${fmtAud(latestLgc.lgc_forward_2026_aud)} | Fwd 2027: ${fmtAud(latestLgc.lgc_forward_2027_aud)}`}
          icon={<Award className="w-5 h-5 text-emerald-400" />}
          accent="bg-emerald-500/15"
        />
        <KpiCard
          title="2024 LRET Surplus"
          value={`+${latest2024?.surplus_deficit_gwh.toFixed(0) ?? '—'} GWh`}
          subtitle={`${latest2024?.surplus_deficit_pct.toFixed(2)}% above 33,000 GWh target`}
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          accent="bg-blue-500/15"
        />
        <KpiCard
          title="Total LGCs Created (2024)"
          value={fmtK(totalLgcsCreated)}
          subtitle="Across all technologies and NEM regions"
          icon={<Leaf className="w-5 h-5 text-amber-400" />}
          accent="bg-amber-500/15"
        />
        <KpiCard
          title="GreenPower Customers"
          value={`${totalGreenPowerCustomers.toLocaleString()}k`}
          subtitle="Accredited GreenPower subscribers nationwide"
          icon={<BadgeCheck className="w-5 h-5 text-purple-400" />}
          accent="bg-purple-500/15"
        />
      </div>

      {/* LGC Price Trend + LRET Surplus/Deficit */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LgcPriceChart data={data.lgc_prices} />
        <SurplusDeficitChart data={data.surplus_deficit} />
      </div>

      {/* LGC Creation by Technology */}
      <CreationByTechChart data={data.creation} />

      {/* Compliance Table + GreenPower Table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ComplianceTable data={data.compliance} />
        <GreenPowerTable data={data.greenpower} />
      </div>

      {/* Footer note */}
      <div className="text-xs text-gray-600 text-center pt-2">
        Sprint 54c — Data: Australian RET Scheme (LRET/SRES) | CEC Accredited Power Stations Registry | GreenPower Program | AEMO LGC Registry
      </div>
    </div>
  )
}
