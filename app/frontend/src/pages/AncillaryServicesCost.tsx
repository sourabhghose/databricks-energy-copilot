import { useEffect, useState } from 'react'
import { Gauge, DollarSign, Zap, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getAncillaryCostDashboard } from '../api/client'
import type {
  AncillaryCostDashboard,
  ASCServiceRecord,
  ASCProviderRecord,
  ASCCostAllocationRecord,
  ASCCauserPaysRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const SERVICE_COLORS: Record<string, string> = {
  RAISE_6SEC:  '#6366f1',
  RAISE_60SEC: '#8b5cf6',
  RAISE_5MIN:  '#a78bfa',
  LOWER_6SEC:  '#f59e0b',
  LOWER_60SEC: '#fb923c',
  LOWER_5MIN:  '#fbbf24',
  RAISE_REG:   '#10b981',
  LOWER_REG:   '#34d399',
}

const PIE_COLORS = [
  '#6366f1', '#8b5cf6', '#10b981', '#f59e0b',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
]

function mechanismBadge(mechanism: string) {
  const cls =
    mechanism === 'CAUSER_PAYS'
      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {mechanism === 'CAUSER_PAYS' ? 'Causer-Pays' : 'Pro-Rata'}
    </span>
  )
}

function causeTypeBadge(causeType: string) {
  const map: Record<string, string> = {
    LOAD_VARIATION:       'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    GENERATION_VARIATION: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    INTERCONNECTOR:       'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    MARKET_NOTICE:        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }
  const label: Record<string, string> = {
    LOAD_VARIATION:       'Load Variation',
    GENERATION_VARIATION: 'Gen Variation',
    INTERCONNECTOR:       'Interconnector',
    MARKET_NOTICE:        'Market Notice',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${map[causeType] ?? ''}`}>
      {causeType === 'MARKET_NOTICE' && <AlertTriangle size={10} />}
      {label[causeType] ?? causeType}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Transform service records into chart-friendly monthly pivot
// ---------------------------------------------------------------------------

function buildServiceTrendData(services: ASCServiceRecord[]) {
  const months = [...new Set(services.map(s => s.month))].sort()
  return months.map(month => {
    const row: Record<string, string | number> = { month }
    services.filter(s => s.month === month).forEach(s => {
      row[s.service] = s.total_cost_m_aud
    })
    return row
  })
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-400', '-900/20')}`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AncillaryServicesCost() {
  const [data, setData] = useState<AncillaryCostDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAncillaryCostDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading ancillary cost data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error ?? 'No data available'}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // KPI derivations
  // -------------------------------------------------------------------------
  const totalFcasCost2024 = data.services.reduce((s, r) => s + r.total_cost_m_aud, 0)

  // Most expensive service by average clearing price
  const byService: Record<string, number[]> = {}
  data.services.forEach(s => {
    if (!byService[s.service]) byService[s.service] = []
    byService[s.service].push(s.clearing_price_aud_mw)
  })
  const avgPriceByService = Object.entries(byService).map(([svc, prices]) => ({
    service: svc,
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
  }))
  const mostExpensiveService = avgPriceByService.sort((a, b) => b.avg - a.avg)[0]

  // Highest cost/MWh region across all months
  const maxCostPerMwh = data.cost_allocations.reduce<ASCCostAllocationRecord>(
    (best, r) => (r.cost_per_mwh_aud > best.cost_per_mwh_aud ? r : best),
    data.cost_allocations[0],
  )

  // RAISE_REG HHI (average across months)
  const raiseRegHhi = data.services
    .filter(s => s.service === 'RAISE_REG')
    .reduce((s, r) => s + r.herfindahl_index, 0) / 3

  // Chart data
  const trendData = buildServiceTrendData(data.services)

  // Top-8 providers by revenue for pie chart
  const top8Providers = [...data.providers]
    .sort((a, b) => b.revenue_m_aud - a.revenue_m_aud)
    .slice(0, 8)

  const pieData = top8Providers.map(p => ({
    name: p.participant.length > 18 ? p.participant.slice(0, 16) + '..' : p.participant,
    value: p.revenue_m_aud,
  }))

  // Latest month allocations for cost allocation table
  const latestMonth = [...new Set(data.cost_allocations.map(c => c.month))].sort().reverse()[0]
  const latestAllocations = data.cost_allocations.filter(c => c.month === latestMonth)

  // Causer-pays sorted by factor desc
  const sortedCauserPays = [...data.causer_pays].sort((a, b) => b.causer_pays_factor - a.causer_pays_factor)

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="text-indigo-500" size={22} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              FCAS &amp; Ancillary Services Cost Allocation
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Causer-pays framework, service market concentration and regional cost allocation — 2024 Q1
          </p>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Updated {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total FCAS Cost Q1 2024"
          value={`$${totalFcasCost2024.toFixed(1)}M`}
          sub="All 8 services combined"
          Icon={DollarSign}
          color="text-indigo-600 dark:text-indigo-400"
        />
        <KpiCard
          label="Most Expensive Service"
          value={mostExpensiveService.service.replace('_', ' ')}
          sub={`Avg $${mostExpensiveService.avg.toFixed(1)}/MW`}
          Icon={Zap}
          color="text-amber-600 dark:text-amber-400"
        />
        <KpiCard
          label="Highest Cost Region"
          value={maxCostPerMwh.region}
          sub={`$${maxCostPerMwh.cost_per_mwh_aud.toFixed(2)}/MWh (${maxCostPerMwh.month})`}
          Icon={Gauge}
          color="text-red-600 dark:text-red-400"
        />
        <KpiCard
          label="RAISE_REG Market HHI"
          value={raiseRegHhi.toFixed(3)}
          sub="Herfindahl-Hirschman Index (avg)"
          Icon={AlertTriangle}
          color="text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Service Cost Trend + Provider Revenue Pie */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Line Chart — service cost monthly trend */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
            FCAS Service Cost Monthly Trend (M AUD)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(v: number) => [`$${v.toFixed(2)}M`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {Object.keys(SERVICE_COLORS).map(svc => (
                <Line
                  key={svc}
                  type="monotone"
                  dataKey={svc}
                  stroke={SERVICE_COLORS[svc]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart — provider revenue */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
            Provider FCAS Revenue Share (Top 8)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`$${v.toFixed(2)}M`, 'Revenue']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-1 gap-1 mt-2">
            {pieData.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto font-semibold text-gray-700 dark:text-gray-200">${p.value.toFixed(2)}M</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost Allocation Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Regional FCAS Cost Allocation — {latestMonth}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Allocated FCAS costs by NEM region and allocation mechanism
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                <th className="px-5 py-3 text-left">Region</th>
                <th className="px-5 py-3 text-right">Total FCAS Cost</th>
                <th className="px-5 py-3 text-right">Energy Share %</th>
                <th className="px-5 py-3 text-right">Allocated Cost</th>
                <th className="px-5 py-3 text-right">Cost / MWh</th>
                <th className="px-5 py-3 text-left">Mechanism</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {latestAllocations.map((a: ASCCostAllocationRecord) => (
                <tr key={`${a.region}-${a.month}`} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="px-5 py-3 font-semibold text-gray-800 dark:text-gray-100">{a.region}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">${a.total_fcas_cost_m_aud.toFixed(2)}M</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{a.energy_market_share_pct.toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">${a.allocated_cost_m_aud.toFixed(2)}M</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-semibold ${a.cost_per_mwh_aud > 1.0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
                      ${a.cost_per_mwh_aud.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-5 py-3">{mechanismBadge(a.allocation_mechanism)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Causer-Pays Leaderboard */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Causer-Pays Leaderboard
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Participants ranked by causer-pays factor — highest contributors to FCAS requirement
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                <th className="px-5 py-3 text-left">Rank</th>
                <th className="px-5 py-3 text-left">Participant</th>
                <th className="px-5 py-3 text-left">Service</th>
                <th className="px-5 py-3 text-right">Causer-Pays Factor</th>
                <th className="px-5 py-3 text-right">Cost Contribution</th>
                <th className="px-5 py-3 text-left">Cause Type</th>
                <th className="px-5 py-3 text-left">Month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedCauserPays.map((cp: ASCCauserPaysRecord, idx: number) => (
                <tr key={`${cp.participant}-${cp.service}-${cp.month}`} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      idx === 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : idx < 3
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{cp.participant}</td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono text-gray-600 dark:text-gray-300">
                      {cp.service}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${(cp.causer_pays_factor / 0.182) * 100}%` }}
                        />
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-gray-100 w-12 text-right">
                        {cp.causer_pays_factor.toFixed(3)}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">
                    ${cp.cost_contribution_m_aud.toFixed(2)}M
                  </td>
                  <td className="px-5 py-3">{causeTypeBadge(cp.cause_type)}</td>
                  <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">{cp.month}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider Detail Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            FCAS Provider Performance
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Market participants providing ancillary services — revenue, enabled capacity and technology
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                <th className="px-5 py-3 text-left">Participant</th>
                <th className="px-5 py-3 text-left">Primary Service</th>
                <th className="px-5 py-3 text-left">Technology</th>
                <th className="px-5 py-3 text-right">Enabled MW</th>
                <th className="px-5 py-3 text-right">Revenue</th>
                <th className="px-5 py-3 text-right">Market Share</th>
                <th className="px-5 py-3 text-right">Avg Enablement Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.providers
                .slice()
                .sort((a: ASCProviderRecord, b: ASCProviderRecord) => b.revenue_m_aud - a.revenue_m_aud)
                .map((p: ASCProviderRecord) => (
                  <tr key={`${p.participant}-${p.service}`} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{p.participant}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-mono">
                        {p.service}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs">{p.technology}</td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{p.enabled_mw.toFixed(0)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">${p.revenue_m_aud.toFixed(2)}M</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-14 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(p.market_share_pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-700 dark:text-gray-200 w-10 text-right">{p.market_share_pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                      {p.avg_enablement_rate_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
