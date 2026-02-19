import { useEffect, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { Sun, Wind } from 'lucide-react'
import { api } from '../api/client'
import type { PpaDashboard, CorporatePpa, LgcMarket, BehindMeterAsset } from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  Wind: '#22c55e',
  'Solar PV': '#f59e0b',
  Hydro: '#3b82f6',
}

const PIE_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#ef4444']

function technologyChip(tech: string) {
  const map: Record<string, string> = {
    Wind: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'Solar PV': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    Hydro: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  }
  return map[tech] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    SIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    ANNOUNCED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    EXPIRED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

function sectorChip(sector: string) {
  const map: Record<string, string> = {
    Tech: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    Mining: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    Retail: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    Manufacturing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    Government: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  }
  return map[sector] ?? 'bg-gray-100 text-gray-700'
}

function structureBadge(structure: string) {
  const map: Record<string, string> = {
    FIXED_PRICE: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    FLOOR_CAP: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    INDEXED: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    PROXY_REVENUE_SWAP: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  }
  return map[structure] ?? 'bg-gray-100 text-gray-700'
}

function shortfallRiskBadge(risk: string) {
  const map: Record<string, string> = {
    NONE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    LOW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    MEDIUM: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  }
  return map[risk] ?? 'bg-gray-100 text-gray-700'
}

function formatInstalledCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}k`
  return String(count)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
          {label}
        </span>
        {icon && <span className="text-gray-400 dark:text-gray-500">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tech Mix Pie Chart
// ---------------------------------------------------------------------------

function TechMixPie({ data }: { data: Array<{ technology: string; capacity_gw: number; pct: number }> }) {
  const chartData = data.map((d) => ({
    name: d.technology,
    value: d.capacity_gw,
    pct: d.pct,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        PPA Technology Mix (GW)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            dataKey="value"
            label={({ name, pct }) => `${name} ${pct}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={TECH_COLORS[entry.name] ?? PIE_COLORS[index % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value.toFixed(2)} GW`, name]}
            contentStyle={{
              backgroundColor: 'var(--tooltip-bg, #1f2937)',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LGC Price Trend Area Chart
// ---------------------------------------------------------------------------

function LgcPriceChart({ data }: { data: LgcMarket[] }) {
  const chartData = data.map((d) => ({
    year: String(d.calendar_year),
    spot: d.lgc_spot_price_aud,
    forward: d.lgc_forward_price_aud,
    risk: d.shortfall_charge_risk,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        LGC Price Trend 2022-2027 (AUD/certificate)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="lgcSpotGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="lgcFwdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
            domain={[0, 70]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
            }}
            formatter={(value: number, name: string) => [
              `$${value.toFixed(2)}/cert`,
              name === 'spot' ? 'Spot Price' : 'Forward Price',
            ]}
          />
          <Legend
            formatter={(value) => (value === 'spot' ? 'Spot Price' : 'Forward Price')}
          />
          <Area
            type="monotone"
            dataKey="spot"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#lgcSpotGrad)"
            dot={{ r: 4, fill: '#22c55e' }}
          />
          <Area
            type="monotone"
            dataKey="forward"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#lgcFwdGrad)"
            dot={{ r: 4, fill: '#3b82f6' }}
            strokeDasharray="5 5"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PPA Contracts Table
// ---------------------------------------------------------------------------

function PpaContractsTable({ ppas }: { ppas: CorporatePpa[] }) {
  const [techFilter, setTechFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')

  const technologies = ['All', ...Array.from(new Set(ppas.map((p) => p.technology)))]
  const statuses = ['All', 'ACTIVE', 'SIGNED', 'ANNOUNCED', 'EXPIRED']

  const filtered = ppas.filter((p) => {
    const techOk = techFilter === 'All' || p.technology === techFilter
    const statusOk = statusFilter === 'All' || p.status === statusFilter
    return techOk && statusOk
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">
          Corporate PPA Contracts
        </h3>
        {/* Technology filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {technologies.map((t) => (
            <button
              key={t}
              onClick={() => setTechFilter(t)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                techFilter === t
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 text-left">
              {[
                'Project Name',
                'Technology',
                'Region',
                'Capacity (MW)',
                'Offtaker',
                'Sector',
                'Price ($/MWh)',
                'Term (yrs)',
                'Annual GWh',
                'LGC',
                'Structure',
                'Status',
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((p) => (
              <tr
                key={p.ppa_id}
                className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {p.project_name}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${technologyChip(p.technology)}`}>
                    {p.technology}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
                    {p.region}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200">
                  {p.capacity_mw.toFixed(0)}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {p.offtaker}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sectorChip(p.offtaker_sector)}`}>
                    {p.offtaker_sector}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-800 dark:text-gray-200">
                  ${p.ppa_price_aud_mwh.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {p.term_years}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {p.annual_energy_gwh.toFixed(0)}
                </td>
                <td className="px-3 py-2 text-center">
                  {p.lgc_included ? (
                    <span className="text-green-600 dark:text-green-400 font-bold">&#10003;</span>
                  ) : (
                    <span className="text-red-400">&#10007;</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${structureBadge(p.structure)}`}>
                    {p.structure.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No PPAs match the selected filters.
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Behind-the-Meter Assets Table
// ---------------------------------------------------------------------------

function BehindMeterTable({ assets }: { assets: BehindMeterAsset[] }) {
  const assetTypeLabel: Record<string, string> = {
    ROOFTOP_SOLAR: 'Rooftop Solar',
    COMMERCIAL_SOLAR: 'Commercial Solar',
    BATTERY: 'Residential BESS',
    COMMERCIAL_BATTERY: 'Commercial Battery',
    CHP: 'CHP (Gas)',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Behind-the-Meter Assets
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 text-left">
              {[
                'Asset Type',
                'State',
                'Installed Count',
                'Total MW',
                'Capacity Factor %',
                'Annual GWh',
                'Avoided Cost ($M)',
                'Certificates',
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {assets.map((a) => (
              <tr
                key={a.asset_id}
                className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                  {assetTypeLabel[a.asset_type] ?? a.asset_type}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {a.state}
                </td>
                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 font-mono">
                  {formatInstalledCount(a.installed_count)}
                </td>
                <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 font-mono">
                  {a.total_installed_mw.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {a.avg_capacity_factor_pct.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 font-mono">
                  {a.annual_generation_gwh.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 font-mono">
                  ${a.avoided_grid_cost_m_aud.toLocaleString()}M
                </td>
                <td className="px-3 py-2">
                  {a.certificates_eligible !== 'None' ? (
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs font-medium">
                      {a.certificates_eligible}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 text-xs">
                      None
                    </span>
                  )}
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
// LGC Market Table
// ---------------------------------------------------------------------------

function LgcMarketTable({ data }: { data: LgcMarket[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          LGC Market Statistics (2022-2027)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 text-left">
              {[
                'Year',
                'Spot ($/cert)',
                'Forward ($/cert)',
                'Created (M)',
                'Surrendered (M)',
                'Banked (M)',
                'Voluntary %',
                'Shortfall Risk',
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.map((d) => (
              <tr
                key={d.calendar_year}
                className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100">
                  {d.calendar_year}
                </td>
                <td className="px-3 py-2 font-mono text-green-700 dark:text-green-400 text-right">
                  ${d.lgc_spot_price_aud.toFixed(2)}
                </td>
                <td className="px-3 py-2 font-mono text-blue-700 dark:text-blue-400 text-right">
                  ${d.lgc_forward_price_aud.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {d.lgcs_created_this_year_m.toFixed(1)}M
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {d.lgcs_surrendered_this_year_m.toFixed(1)}M
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {d.lgcs_banked_m.toFixed(1)}M
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {d.voluntary_surrender_pct.toFixed(1)}%
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${shortfallRiskBadge(d.shortfall_charge_risk)}`}>
                    {d.shortfall_charge_risk}
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
// Main page
// ---------------------------------------------------------------------------

export default function PpaMarket() {
  const [dashboard, setDashboard] = useState<PpaDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getPpaDashboard()
      .then((d) => {
        setDashboard(d)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading PPA market data...
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        {error ?? 'Failed to load PPA dashboard.'}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Wind className="text-green-500" size={22} />
            Corporate PPA &amp; Green Energy Market
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Large-scale renewable PPAs, LGC certificate market, and behind-the-meter analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Sun size={16} className="text-amber-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">LGC Spot:</span>
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-sm font-bold">
            ${dashboard.lgc_spot_price.toFixed(2)}/cert
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total PPA Capacity"
          value={`${dashboard.total_ppa_capacity_gw.toFixed(2)} GW`}
          sub="across all NEM regions"
          icon={<Wind size={16} />}
        />
        <KpiCard
          label="Active PPAs"
          value={String(dashboard.active_ppas)}
          sub="contracted & generating"
        />
        <KpiCard
          label="Pipeline PPAs"
          value={String(dashboard.pipeline_ppas)}
          sub="signed + announced"
        />
        <KpiCard
          label="Avg PPA Price"
          value={`$${dashboard.avg_ppa_price_aud_mwh.toFixed(2)}/MWh`}
          sub="active contracts"
          icon={<Sun size={16} />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TechMixPie data={dashboard.tech_mix} />
        <LgcPriceChart data={dashboard.lgc_market} />
      </div>

      {/* PPA Contracts Table */}
      <PpaContractsTable ppas={dashboard.ppas} />

      {/* LGC Market Table */}
      <LgcMarketTable data={dashboard.lgc_market} />

      {/* Behind-the-Meter Assets Table */}
      <BehindMeterTable assets={dashboard.behind_meter_assets} />

      {/* Rooftop Solar Summary Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 flex items-center gap-4">
        <Sun size={24} className="text-amber-500 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Rooftop Solar Fleet: {dashboard.rooftop_solar_total_gw.toFixed(1)} GW installed
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            3.4M systems nationwide — Australia&apos;s largest distributed energy resource, eligible for STCs under the SRES
          </div>
        </div>
      </div>
    </div>
  )
}
