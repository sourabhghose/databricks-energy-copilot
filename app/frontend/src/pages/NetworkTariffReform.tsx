import { useEffect, useState } from 'react'
import { CircuitBoard, RefreshCw, DollarSign, Users, Zap, TrendingDown } from 'lucide-react'
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import {
  api,
  NetworkTariffReformDashboard,
  DnspTariffRecord48c,
  DnspRevenueRecord,
  TariffReformRecord,
  DerNetworkImpactRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function StructureTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    FLAT:            'bg-gray-700 text-gray-200 border border-gray-600',
    TOU:             'bg-blue-900 text-blue-300 border border-blue-700',
    DEMAND:          'bg-purple-900 text-purple-300 border border-purple-700',
    CAPACITY:        'bg-amber-900 text-amber-300 border border-amber-700',
    INCLINING_BLOCK: 'bg-cyan-900 text-cyan-300 border border-cyan-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[type] ?? 'bg-gray-700 text-gray-300'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function ReformStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    LEGACY:       'bg-gray-700 text-gray-300 border border-gray-600',
    TRANSITIONING:'bg-amber-900 text-amber-300 border border-amber-700',
    REFORMED:     'bg-green-900 text-green-300 border border-green-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  )
}

function TariffCategoryBadge({ cat }: { cat: string }) {
  const styles: Record<string, string> = {
    RESIDENTIAL:   'bg-blue-900 text-blue-300',
    SME:           'bg-indigo-900 text-indigo-300',
    LARGE_BUSINESS:'bg-purple-900 text-purple-300',
    EV:            'bg-cyan-900 text-cyan-300',
    SOLAR_EXPORT:  'bg-amber-900 text-amber-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[cat] ?? 'bg-gray-700 text-gray-300'}`}>
      {cat.replace('_', ' ')}
    </span>
  )
}

function ReformTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    COST_REFLECTIVE: 'bg-blue-900 text-blue-300 border border-blue-700',
    DER_INTEGRATION: 'bg-green-900 text-green-300 border border-green-700',
    EV_TARIFF:       'bg-cyan-900 text-cyan-300 border border-cyan-700',
    SOLAR_EXPORT:    'bg-amber-900 text-amber-300 border border-amber-700',
    CAPACITY_BASED:  'bg-purple-900 text-purple-300 border border-purple-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[type] ?? 'bg-gray-700 text-gray-300'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PROPOSED:     'bg-gray-700 text-gray-300 border border-gray-600',
    APPROVED:     'bg-blue-900 text-blue-300 border border-blue-700',
    TRANSITIONING:'bg-amber-900 text-amber-300 border border-amber-700',
    COMPLETE:     'bg-green-900 text-green-300 border border-green-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  )
}

function AerPositionBadge({ position }: { position: string }) {
  const styles: Record<string, string> = {
    SUPPORTED:   'bg-green-900 text-green-300 border border-green-700',
    CONDITIONAL: 'bg-amber-900 text-amber-300 border border-amber-700',
    OPPOSED:     'bg-red-900 text-red-300 border border-red-700',
    REVIEWING:   'bg-gray-700 text-gray-300 border border-gray-600',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${styles[position] ?? 'bg-gray-700 text-gray-300'}`}>
      {position}
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, Icon }: { label: string; value: string; sub?: string; Icon: React.ElementType }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-3">
      <div className="p-2 bg-gray-700 rounded-lg shrink-0">
        <Icon size={20} className="text-amber-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DER Network Impact Chart (stacked bar + line)
// ---------------------------------------------------------------------------

function DerImpactChart({ data }: { data: DerNetworkImpactRecord[] }) {
  const filtered = data.filter(d => d.year === 2024)
  const chartData = filtered.map(d => ({
    name: d.dnsp_name.replace(' Energy', '').replace(' Power Networks', ''),
    rooftop_solar: d.rooftop_solar_gw,
    home_battery: d.home_battery_gw,
    ev_charger: d.ev_charger_gw,
    hosting_pct: d.hosting_capacity_constraint_pct,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'GW', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: '% Feeders', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
        <Bar yAxisId="left" dataKey="rooftop_solar" name="Rooftop Solar (GW)" stackId="a" fill="#f59e0b" />
        <Bar yAxisId="left" dataKey="home_battery" name="Home Battery (GW)" stackId="a" fill="#3b82f6" />
        <Bar yAxisId="left" dataKey="ev_charger" name="EV Charger (GW)" stackId="a" fill="#10b981" />
        <Line yAxisId="right" type="monotone" dataKey="hosting_pct" name="Hosting Cap. Constraint %" stroke="#f87171" strokeWidth={2} dot={{ r: 4, fill: '#f87171' }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NetworkTariffReform() {
  const [dashboard, setDashboard] = useState<NetworkTariffReformDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stateFilter, setStateFilter] = useState('ALL')
  const [structureFilter, setStructureFilter] = useState('ALL')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getNetworkTariffReformDashboard()
      setDashboard(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredTariffs: DnspTariffRecord48c[] = dashboard?.dnsp_tariffs.filter(t => {
    if (stateFilter !== 'ALL' && t.state !== stateFilter) return false
    if (structureFilter !== 'ALL' && t.structure_type !== structureFilter) return false
    return true
  }) ?? []

  const uniqueStates = Array.from(new Set(dashboard?.dnsp_tariffs.map(t => t.state) ?? []))
  const structureTypes = ['FLAT', 'TOU', 'DEMAND', 'CAPACITY', 'INCLINING_BLOCK']

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg mt-0.5">
            <CircuitBoard size={24} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Network Tariff Reform & DNSP Analytics</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Cost-reflective pricing reform, DER integration tariffs, and distribution network revenue allowances
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>
      )}

      {loading && !dashboard && (
        <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
      )}

      {dashboard && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Total Network Revenue"
              value={`$${dashboard.total_network_revenue_b_aud.toFixed(2)}B`}
              sub="AUD — Regulatory Allowance"
              Icon={DollarSign}
            />
            <KpiCard
              label="Reformed Customers"
              value={`${dashboard.reformed_customers_pct}%`}
              sub="Tariff portfolios reformed"
              Icon={Users}
            />
            <KpiCard
              label="Avg Peak Demand Reduction"
              value={`${dashboard.avg_peak_demand_reduction_mw.toFixed(1)} MW`}
              sub="Avg across reform programs"
              Icon={TrendingDown}
            />
            <KpiCard
              label="Network Augmentation Avoided"
              value={`$${dashboard.network_augmentation_avoided_b_aud.toFixed(2)}B`}
              sub="AUD avoided via DER (2024)"
              Icon={Zap}
            />
          </div>

          {/* DER Network Impact Chart */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">
              DER Network Impact by DNSP (2024) — Installed Capacity & Hosting Constraint
            </h2>
            <DerImpactChart data={dashboard.der_network_impacts} />
          </div>

          {/* DNSP Tariffs Table */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-gray-200">DNSP Tariff Structures</h2>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={stateFilter}
                  onChange={e => setStateFilter(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1.5"
                >
                  <option value="ALL">All States</option>
                  {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={structureFilter}
                  onChange={e => setStructureFilter(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1.5"
                >
                  <option value="ALL">All Structures</option>
                  {structureTypes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">DNSP</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">State</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Tariff Name</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Category</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Structure</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Supply Charge $/day</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Peak Rate</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Demand $/kW/mo</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Export c/kWh</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Customers</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Reform Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTariffs.map(t => (
                    <tr key={t.dnsp_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="py-2 px-2 text-white font-medium">{t.dnsp_name}</td>
                      <td className="py-2 px-2 text-gray-300">{t.state}</td>
                      <td className="py-2 px-2 text-gray-300">{t.tariff_name}</td>
                      <td className="py-2 px-2"><TariffCategoryBadge cat={t.tariff_category} /></td>
                      <td className="py-2 px-2"><StructureTypeBadge type={t.structure_type} /></td>
                      <td className="py-2 px-2 text-right text-gray-300">{t.daily_supply_charge.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{t.peak_rate_kw_or_kwh.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-400">{t.demand_charge_kw_month != null ? t.demand_charge_kw_month.toFixed(2) : '—'}</td>
                      <td className="py-2 px-2 text-right text-amber-400">{t.solar_export_rate != null ? t.solar_export_rate.toFixed(2) : '—'}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{t.customer_count.toLocaleString()}</td>
                      <td className="py-2 px-2"><ReformStatusBadge status={t.reform_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTariffs.length === 0 && (
                <p className="text-center text-gray-500 py-6 text-xs">No tariffs match the selected filters.</p>
              )}
            </div>
          </div>

          {/* DNSP Revenue Table */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">DNSP Revenue Allowances (AER Regulatory Determinations)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">DNSP</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">State</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Reg. Period</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Revenue $B</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Capex $B</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Opex $B</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">WACC %</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">RAB $B</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Customers</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Avg Rev/Cust $</th>
                    <th className="text-center py-2 px-2 text-gray-400 font-medium">AER Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.dnsp_revenue.map((r, i) => (
                    <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="py-2 px-2 text-white font-medium">{r.dnsp_name}</td>
                      <td className="py-2 px-2 text-gray-300">{r.state}</td>
                      <td className="py-2 px-2 text-gray-300">{r.regulatory_period}</td>
                      <td className="py-2 px-2 text-right text-amber-300 font-semibold">{r.total_revenue_allowance_b_aud.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{r.capex_allowance_b_aud.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{r.opex_allowance_b_aud.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-blue-300">{r.wacc_pct.toFixed(2)}%</td>
                      <td className="py-2 px-2 text-right text-gray-300">{r.regulatory_asset_base_b_aud.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{r.customer_numbers.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{r.avg_revenue_per_customer_aud.toFixed(0)}</td>
                      <td className="py-2 px-2 text-center">
                        {r.aer_approved
                          ? <span className="text-green-400 font-bold">Yes</span>
                          : <span className="text-gray-500">Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tariff Reform Tracker */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">Tariff Reform Tracker</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Reform Name</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">DNSP</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">State</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Reform Type</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Impl. Date</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Customers</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Bill Change %</th>
                    <th className="text-right py-2 px-2 text-gray-400 font-medium">Peak Reduction MW</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">Status</th>
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">AER Position</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.tariff_reforms.map(r => (
                    <tr key={r.reform_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="py-2 px-2 text-white font-medium max-w-xs">{r.reform_name}</td>
                      <td className="py-2 px-2 text-gray-300">{r.dnsp_name}</td>
                      <td className="py-2 px-2 text-gray-300">{r.state}</td>
                      <td className="py-2 px-2"><ReformTypeBadge type={r.reform_type} /></td>
                      <td className="py-2 px-2 text-gray-300">{r.implementation_date}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{r.customers_affected.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right">
                        <span className={r.avg_bill_change_pct < 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                          {r.avg_bill_change_pct > 0 ? '+' : ''}{r.avg_bill_change_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-cyan-300">{r.peak_demand_reduction_mw.toFixed(1)}</td>
                      <td className="py-2 px-2"><StatusBadge status={r.status} /></td>
                      <td className="py-2 px-2"><AerPositionBadge position={r.aer_position} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
