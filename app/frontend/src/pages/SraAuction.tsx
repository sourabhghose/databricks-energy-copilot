import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ArrowLeftRight, DollarSign, TrendingUp, Activity, AlertTriangle } from 'lucide-react'
import { api } from '../api/client'
import type { SraDashboard, SraUnit, SraAuctionResult, InterconnectorRevenueSummary } from '../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtM(n: number) {
  return `$${(n / 1_000_000).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
}

function fmtK(n: number) {
  return `$${(n / 1_000).toLocaleString('en-AU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  accent: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${accent}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function DirectionChip({ direction }: { direction: string }) {
  const isImport = direction === 'IMPORT'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
        isImport
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      }`}
    >
      {direction}
    </span>
  )
}

function OverSubChip({ ratio }: { ratio: number }) {
  let cls = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  if (ratio > 2) cls = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  else if (ratio > 1.5) cls = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {fmt(ratio, 1)}x
    </span>
  )
}

function ParticipantChip({ name }: { name: string }) {
  const colors: Record<string, string> = {
    'AGL Energy': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    'Origin Energy': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    EnergyAustralia: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    'Macquarie Energy': 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    'Alinta Energy': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  }
  const cls = colors[name] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{name}</span>
  )
}

function UtilisationBar({ pct }: { pct: number }) {
  let barColor = 'bg-green-500'
  if (pct < 60) barColor = 'bg-amber-500'
  else if (pct < 75) barColor = 'bg-yellow-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 min-w-[60px]">
        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400 w-10 text-right">{fmt(pct, 0)}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auction Results Table
// ---------------------------------------------------------------------------

function AuctionResultsTable({ results }: { results: SraAuctionResult[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Activity size={16} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">SRA Auction Results — Q1 2026</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 text-left">
              <th className="px-4 py-2.5 font-medium">Auction ID</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Interconnector</th>
              <th className="px-4 py-2.5 font-medium">Direction</th>
              <th className="px-4 py-2.5 font-medium text-right">Offered MW</th>
              <th className="px-4 py-2.5 font-medium text-right">Clearing ($/MWh)</th>
              <th className="px-4 py-2.5 font-medium text-right">Allocated MW</th>
              <th className="px-4 py-2.5 font-medium text-right">Over-sub</th>
              <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
              <th className="px-4 py-2.5 font-medium text-right">Participants</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {results.map(r => {
              const isHighPrice = r.clearing_price_aud_mwh >= 15
              const isMedPrice = r.clearing_price_aud_mwh >= 8
              const priceClass = isHighPrice
                ? 'text-red-600 dark:text-red-400 font-semibold'
                : isMedPrice
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-700 dark:text-gray-300'
              return (
                <tr key={r.auction_id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">{r.auction_id}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{r.auction_date}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{r.interconnector_id}</td>
                  <td className="px-4 py-2.5">
                    <DirectionChip direction={r.direction} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmt(r.total_units_offered_mw, 0)}</td>
                  <td className={`px-4 py-2.5 text-right ${priceClass}`}>${fmt(r.clearing_price_aud_mwh, 2)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmt(r.units_allocated_mw, 0)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <OverSubChip ratio={r.over_subscription_ratio} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmtM(r.total_revenue_aud)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{r.num_participants}</td>
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
// Interconnector Revenue BarChart
// ---------------------------------------------------------------------------

function InterconnectorRevenueChart({ data }: { data: InterconnectorRevenueSummary[] }) {
  const chartData = data.map(d => ({
    name: d.interconnector_id,
    'Settlement Residues ($M)': +(d.total_settlement_residue_aud / 1_000_000).toFixed(2),
    'SRA Allocated %': +d.sra_revenue_allocated_pct.toFixed(1),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} className="text-emerald-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Interconnector Settlement Residues vs SRA Allocation — Q1 2026
        </h2>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: '$M', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: '%', angle: 90, position: 'insideRight', style: { fontSize: 10 } }} domain={[0, 100]} />
          <Tooltip
            formatter={(value: number, name: string) =>
              name.includes('$M') ? [`$${fmt(value, 2)}M`, name] : [`${fmt(value, 1)}%`, name]
            }
          />
          <Legend />
          <Bar yAxisId="left" dataKey="Settlement Residues ($M)" fill="#6366f1" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="right" dataKey="SRA Allocated %" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active SRA Units Table
// ---------------------------------------------------------------------------

const ALL_INTERCONNECTORS = ['All', 'SA1-VIC1', 'VIC1-NSW1', 'QLD1-NSW1', 'VIC1-TAS1']

function ActiveUnitsTable({ units }: { units: SraUnit[] }) {
  const [filter, setFilter] = useState('All')
  const filtered = filter === 'All' ? units : units.filter(u => u.interconnector_id === filter)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={16} className="text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Active SRA Units</h2>
          <span className="ml-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </div>
        <div className="flex gap-1">
          {ALL_INTERCONNECTORS.map(ic => (
            <button
              key={ic}
              onClick={() => setFilter(ic)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === ic
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 text-left">
              <th className="px-4 py-2.5 font-medium">Unit ID</th>
              <th className="px-4 py-2.5 font-medium">Interconnector</th>
              <th className="px-4 py-2.5 font-medium">Direction</th>
              <th className="px-4 py-2.5 font-medium">Quarter</th>
              <th className="px-4 py-2.5 font-medium text-right">Allocated MW</th>
              <th className="px-4 py-2.5 font-medium text-right">Auction Price</th>
              <th className="px-4 py-2.5 font-medium">Holder</th>
              <th className="px-4 py-2.5 font-medium">Utilisation</th>
              <th className="px-4 py-2.5 font-medium text-right">Residue Rev.</th>
              <th className="px-4 py-2.5 font-medium text-right">Net Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(u => {
              const netPositive = u.net_value_aud >= 0
              return (
                <tr key={u.unit_id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-gray-700 dark:text-gray-300">{u.unit_id}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{u.interconnector_id}</td>
                  <td className="px-4 py-2.5">
                    <DirectionChip direction={u.direction} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{u.quarter}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmt(u.allocated_mw, 0)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">${fmt(u.auction_price_aud_mwh, 2)}</td>
                  <td className="px-4 py-2.5">
                    <ParticipantChip name={u.holder_participant} />
                  </td>
                  <td className="px-4 py-2.5 min-w-[140px]">
                    <UtilisationBar pct={u.utilisation_pct} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{fmtK(u.residue_revenue_aud)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${netPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {netPositive ? '+' : ''}{fmtK(u.net_value_aud)}
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
// Interconnector Summary Cards
// ---------------------------------------------------------------------------

function InterconnectorCards({ data }: { data: InterconnectorRevenueSummary[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ArrowLeftRight size={16} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Interconnector Summary Cards</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {data.map(ic => {
          const highCongestion = ic.congestion_hours_pct > 50
          return (
            <div
              key={ic.interconnector_id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{ic.interconnector_id}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{ic.from_region} → {ic.to_region}</span>
              </div>

              {/* Congestion */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Congestion hours</span>
                  {highCongestion && (
                    <AlertTriangle size={12} className="text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${highCongestion ? 'bg-red-500' : 'bg-amber-400'}`}
                      style={{ width: `${ic.congestion_hours_pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold w-10 text-right ${highCongestion ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {fmt(ic.congestion_hours_pct, 0)}%
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Avg Price Diff</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    ${fmt(ic.avg_price_differential, 2)}/MWh
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Total Flow</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {fmt(ic.total_flow_twh, 2)} TWh
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Settlement Residues</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {fmtM(ic.total_settlement_residue_aud)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Avg Utilisation</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {fmt(ic.avg_utilisation_pct, 0)}%
                  </p>
                </div>
              </div>

              {/* Thermal limit */}
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <span className="text-xs text-gray-400 dark:text-gray-500">Thermal limit</span>
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{fmt(ic.thermal_limit_mw, 0)} MW</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SraAuction() {
  const [dashboard, setDashboard] = useState<SraDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getSraDashboard()
      .then(d => {
        setDashboard(d)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message ?? 'Failed to load SRA data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-500 dark:text-gray-400 text-sm">Loading SRA data…</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="p-6 text-red-600 dark:text-red-400 text-sm">
        Error: {error ?? 'No data available'}
      </div>
    )
  }

  const totalRevM = dashboard.total_sra_revenue_this_quarter / 1_000_000
  const totalResiduesM = dashboard.total_residues_distributed_aud / 1_000_000

  return (
    <div className="p-6 space-y-6 min-h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight size={22} className="text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Settlement Residue Auctions &amp; Interconnector Rights
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            SRA unit allocations, auction clearing prices, firm transfer right utilisation and interconnector revenue analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
            {dashboard.current_quarter}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Active SRA Units"
          value={String(dashboard.total_sra_units_active)}
          sub="Across 4 interconnectors"
          Icon={ArrowLeftRight}
          accent="bg-blue-500"
        />
        <KpiCard
          label="SRA Revenue This Quarter"
          value={`$${fmt(totalRevM, 2)}M`}
          sub="Residue revenue from active units"
          Icon={DollarSign}
          accent="bg-emerald-500"
        />
        <KpiCard
          label="Best Performing Interconnector"
          value={dashboard.best_performing_interconnector}
          sub="Highest settlement residues"
          Icon={TrendingUp}
          accent="bg-purple-500"
        />
        <KpiCard
          label="Total Residues Distributed"
          value={`$${fmt(totalResiduesM, 1)}M`}
          sub="All interconnectors, Q1 2026"
          Icon={DollarSign}
          accent="bg-amber-500"
        />
      </div>

      {/* Auction Results Table */}
      <AuctionResultsTable results={dashboard.auction_results} />

      {/* Revenue BarChart */}
      <InterconnectorRevenueChart data={dashboard.interconnector_revenue} />

      {/* Active Units Table */}
      <ActiveUnitsTable units={dashboard.active_units} />

      {/* Interconnector Summary Cards */}
      <InterconnectorCards data={dashboard.interconnector_revenue} />

      {/* Footer */}
      <div className="text-xs text-gray-400 dark:text-gray-500 text-center pt-2">
        Data: AEMO SRA Quarterly Auction Results — {dashboard.current_quarter} &bull; Cached hourly &bull; All prices in AUD
      </div>
    </div>
  )
}
