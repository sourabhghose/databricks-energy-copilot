import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'
import { Receipt, DollarSign, TrendingUp, TrendingDown, Zap, Sun } from 'lucide-react'
import { api } from '../api/client'
import type { TariffDashboard, TariffComponent, TouTariffStructure, BillComposition } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const COMPONENT_COLOURS: Record<string, string> = {
  ENERGY:       '#3b82f6', // blue
  NETWORK:      '#f59e0b', // amber
  ENVIRONMENT:  '#22c55e', // green
  METERING:     '#6b7280', // gray
  RETAIL_MARGIN:'#a855f7', // purple
  LOSSES:       '#94a3b8', // slate
}

const PIE_COLOURS = [
  COMPONENT_COLOURS.ENERGY,
  COMPONENT_COLOURS.NETWORK,
  COMPONENT_COLOURS.ENVIRONMENT,
  COMPONENT_COLOURS.METERING,
  COMPONENT_COLOURS.RETAIL_MARGIN,
]

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'blue',
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent?: 'blue' | 'amber' | 'green' | 'purple'
}) {
  const ring: Record<string, string> = {
    blue:   'border-blue-200 dark:border-blue-800',
    amber:  'border-amber-200 dark:border-amber-800',
    green:  'border-green-200 dark:border-green-800',
    purple: 'border-purple-200 dark:border-purple-800',
  }
  const iconBg: Record<string, string> = {
    blue:   'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    amber:  'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
    green:  'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
  }
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border ${ring[accent]} p-4 flex items-start gap-4`}>
      <div className={`p-2.5 rounded-lg ${iconBg[accent]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function StateChip({ label, state, variant }: { label: string; state: string; variant: 'green' | 'red' }) {
  const colours = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    red:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${colours[variant]}`}>
      {variant === 'green' ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
      {label}: <strong>{state}</strong>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltip for stacked bar chart
// ---------------------------------------------------------------------------
function BillTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + p.value, 0)
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[160px]">
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-3 text-xs mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: p.fill }} />
            <span className="text-gray-600 dark:text-gray-400 capitalize">{p.name}</span>
          </span>
          <span className="font-medium text-gray-800 dark:text-gray-200">${p.value.toFixed(0)}</span>
        </div>
      ))}
      <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-1 flex justify-between text-xs font-semibold">
        <span className="text-gray-600 dark:text-gray-400">Total</span>
        <span className="text-gray-900 dark:text-gray-100">${total.toFixed(0)}/yr</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function TariffAnalytics() {
  const [dashboard, setDashboard] = useState<TariffDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedState, setSelectedState] = useState<string>('NSW')
  const [filterState, setFilterState] = useState<string>('')
  const [filterCustomerType, setFilterCustomerType] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    api.getTariffDashboard()
      .then(d => { setDashboard(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  // Filtered tariff components
  const filteredComponents = useMemo<TariffComponent[]>(() => {
    if (!dashboard) return []
    return dashboard.tariff_components.filter(c => {
      if (filterState && c.state !== filterState) return false
      if (filterCustomerType && c.customer_type !== filterCustomerType) return false
      return true
    })
  }, [dashboard, filterState, filterCustomerType])

  // Bill composition data for stacked bar chart
  const billBarData = useMemo(() => {
    if (!dashboard) return []
    return dashboard.bill_compositions.map(c => ({
      state: c.state,
      Energy:      c.energy_cost_aud,
      Network:     c.network_cost_aud,
      Environment: c.environmental_cost_aud,
      Metering:    c.metering_cost_aud,
      Retail:      c.retail_margin_aud,
    }))
  }, [dashboard])

  // Pie chart data for selected state
  const pieData = useMemo(() => {
    if (!dashboard) return []
    const comp = dashboard.bill_compositions.find(c => c.state === selectedState)
    if (!comp) return []
    return [
      { name: 'Energy',      value: comp.energy_cost_aud,        pct: comp.energy_pct },
      { name: 'Network',     value: comp.network_cost_aud,       pct: comp.network_pct },
      { name: 'Environment', value: comp.environmental_cost_aud, pct: comp.env_pct },
      { name: 'Metering',    value: comp.metering_cost_aud,      pct: parseFloat(((comp.metering_cost_aud / comp.total_annual_bill_aud) * 100).toFixed(1)) },
      { name: 'Retail',      value: comp.retail_margin_aud,      pct: parseFloat(((comp.retail_margin_aud / comp.total_annual_bill_aud) * 100).toFixed(1)) },
    ]
  }, [dashboard, selectedState])

  const availableStates = useMemo<string[]>(() => {
    if (!dashboard) return []
    return [...new Set(dashboard.tariff_components.map(c => c.state))].sort()
  }, [dashboard])

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="p-6 text-red-600 dark:text-red-400 font-medium">
        Failed to load tariff data: {error}
      </div>
    )
  }

  const selectedComposition = dashboard.bill_compositions.find(c => c.state === selectedState)

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
            <Receipt size={22} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Electricity Retail Tariff &amp; Bill Analytics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Time-of-use tariffs, demand charges, network pass-through &amp; annual bill composition
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StateChip label="Cheapest" state={dashboard.cheapest_state} variant="green" />
          <StateChip label="Most Expensive" state={dashboard.most_expensive_state} variant="red" />
        </div>
      </div>

      {/* ---- KPI Cards ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="National Avg Residential Bill"
          value={`$${dashboard.national_avg_residential_bill_aud.toLocaleString()}/yr`}
          sub="5,000 kWh/yr household"
          icon={DollarSign}
          accent="blue"
        />
        <KpiCard
          label={`Cheapest State (${dashboard.cheapest_state})`}
          value={`$${dashboard.bill_compositions.find(c => c.state === dashboard.cheapest_state)?.total_annual_bill_aud.toLocaleString() ?? '—'}/yr`}
          sub={`Avg ${dashboard.bill_compositions.find(c => c.state === dashboard.cheapest_state)?.avg_c_kwh_all_in.toFixed(1) ?? '—'} c/kWh all-in`}
          icon={TrendingDown}
          accent="green"
        />
        <KpiCard
          label="Network Cost Share"
          value={`${dashboard.network_cost_share_pct.toFixed(1)}%`}
          sub="National avg % of residential bill"
          icon={Zap}
          accent="amber"
        />
        <KpiCard
          label="Avg Solar Export Rate"
          value={`${dashboard.avg_solar_export_rate_c_kwh.toFixed(2)} c/kWh`}
          sub={`TOU adoption: ${dashboard.tou_adoption_pct}% of meters`}
          icon={Sun}
          accent="purple"
        />
      </div>

      {/* ---- Charts row ---- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Stacked bar chart — Annual Bill by State */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Annual Residential Bill by State (5,000 kWh/yr)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={billBarData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="state" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} width={55} />
              <Tooltip content={<BillTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={1800} stroke="#6b7280" strokeDasharray="4 4" label={{ value: 'Nat. avg $1,800', position: 'insideTopRight', fontSize: 11, fill: '#6b7280' }} />
              <Bar dataKey="Energy"      stackId="a" fill={COMPONENT_COLOURS.ENERGY}       radius={[0,0,0,0]} />
              <Bar dataKey="Network"     stackId="a" fill={COMPONENT_COLOURS.NETWORK}      />
              <Bar dataKey="Environment" stackId="a" fill={COMPONENT_COLOURS.ENVIRONMENT}  />
              <Bar dataKey="Metering"    stackId="a" fill={COMPONENT_COLOURS.METERING}     />
              <Bar dataKey="Retail"      stackId="a" fill={COMPONENT_COLOURS.RETAIL_MARGIN} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart — Bill composition for selected state */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Bill Composition
            </h2>
            <select
              value={selectedState}
              onChange={e => setSelectedState(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {dashboard.bill_compositions.map(c => (
                <option key={c.state} value={c.state}>{c.state}</option>
              ))}
            </select>
          </div>
          {selectedComposition && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Total: <strong className="text-gray-800 dark:text-gray-200">${selectedComposition.total_annual_bill_aud.toLocaleString()}/yr</strong>
              &nbsp;&nbsp;All-in: <strong className="text-gray-800 dark:text-gray-200">{selectedComposition.avg_c_kwh_all_in.toFixed(1)} c/kWh</strong>
            </p>
          )}
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, pct }) => `${name} ${pct}%`}
                labelLine={true}
              >
                {pieData.map((_entry, idx) => (
                  <Cell key={idx} fill={PIE_COLOURS[idx % PIE_COLOURS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`$${value.toFixed(0)}`, '']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- TOU Tariff Structure table ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Time-of-Use Tariff Structures by DNSP
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['State', 'DNSP', 'Tariff Name', 'Peak (c/kWh)', 'Shoulder (c/kWh)', 'Off-Peak (c/kWh)', 'Supply ($/day)', 'Solar Export (c/kWh)', 'Demand ($/kW/mth)', 'Typical Annual Bill'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide py-2 px-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboard.tou_structures.map((s: TouTariffStructure, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-gray-200">{s.state}</td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{s.dnsp}</td>
                  <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 max-w-[180px] truncate" title={s.tariff_name}>{s.tariff_name}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {s.peak_rate_c_kwh.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {s.shoulder_rate_c_kwh.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {s.off_peak_rate_c_kwh.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">${s.daily_supply_charge_aud.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{s.solar_export_rate_c_kwh.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">
                    {s.demand_charge_aud_kw_mth != null ? `$${s.demand_charge_aud_kw_mth.toFixed(2)}` : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-gray-200">${s.typical_annual_bill_aud.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Peak hours legend for SA (most complex) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {['peak', 'shoulder', 'off_peak'].map(period => {
            const sa = dashboard.tou_structures.find(s => s.state === 'SA')
            if (!sa) return null
            const hourMap: Record<string, { label: string; hours: string; colour: string }> = {
              peak:      { label: 'SA Peak',       hours: sa.peak_hours,      colour: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' },
              shoulder:  { label: 'SA Shoulder',   hours: sa.shoulder_hours,  colour: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' },
              off_peak:  { label: 'SA Off-Peak',   hours: sa.off_peak_hours,  colour: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' },
            }
            const { label, hours, colour } = hourMap[period]
            return (
              <div key={period} className={`text-xs border rounded-lg px-3 py-2 ${colour}`}>
                <span className="font-semibold">{label}: </span>{hours}
              </div>
            )
          })}
        </div>
      </div>

      {/* ---- Tariff Components breakdown table ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Tariff Component Breakdown
          </h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterState}
              onChange={e => setFilterState(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <option value="">All States</option>
              {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filterCustomerType}
              onChange={e => setFilterCustomerType(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <option value="">All Customer Types</option>
              <option value="RESIDENTIAL">Residential</option>
              <option value="SME">SME</option>
              <option value="LARGE_COMMERCIAL">Large Commercial</option>
            </select>
            <span className="text-xs text-gray-400 dark:text-gray-500 self-center">
              {filteredComponents.length} records
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['State', 'Customer Type', 'Tariff Type', 'Component', 'Rate (c/kWh)', '% of Bill', 'YoY Change', 'Regulated'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide py-2 px-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredComponents.map((c: TariffComponent, idx: number) => {
                const colour = COMPONENT_COLOURS[c.component] ?? '#6b7280'
                const isPositive = c.yoy_change_pct > 0
                const isNegative = c.yoy_change_pct < 0
                return (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">{c.state}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                      <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {c.customer_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-500 text-xs">{c.tariff_type}</td>
                    <td className="py-2 px-3">
                      <span className="flex items-center gap-1.5 font-medium" style={{ color: colour }}>
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: colour }} />
                        {c.component}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">{c.rate_c_kwh.toFixed(2)}</td>
                    <td className="py-2 px-3 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${Math.min(c.pct_of_total_bill, 100)}%`, background: colour }}
                          />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 font-medium w-10 text-right">
                          {c.pct_of_total_bill.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`flex items-center gap-0.5 font-medium text-xs ${isPositive ? 'text-red-600 dark:text-red-400' : isNegative ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                        {isPositive && <TrendingUp size={11} />}
                        {isNegative && <TrendingDown size={11} />}
                        {isPositive ? '+' : ''}{c.yoy_change_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {c.regulated ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Regulated
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          Market
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredComponents.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
              No components match the selected filters.
            </div>
          )}
        </div>
      </div>

      {/* ---- Tariff Reform Note ---- */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
          <Receipt size={14} />
          Cost-Reflective Tariff Reform — Key Insights
        </h3>
        <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5 list-disc list-inside">
          <li>Network costs represent <strong>{dashboard.network_cost_share_pct.toFixed(1)}%</strong> of the average residential bill nationally — the largest regulated component.</li>
          <li>SA has the highest network cost share (~43%) driven by high capital investment in the Riverland and remote network augmentation.</li>
          <li>Moving to cost-reflective TOU tariffs can reduce peak demand by 5-15%, improving network utilisation and reducing future capex requirements.</li>
          <li>Solar export rates have declined significantly (now {dashboard.avg_solar_export_rate_c_kwh.toFixed(1)} c/kWh avg) reflecting grid saturation in midday periods — driving interest in battery storage.</li>
          <li>QLD remains on flat-rate tariffs (Tariff 11) with <strong>no TOU mandate</strong>, limiting demand response signals to distributed consumers.</li>
          <li>Environmental levies (LRET, VEET, ESS) are highest in VIC, reflecting state-level renewable energy obligations above the national RET scheme.</li>
        </ul>
      </div>

    </div>
  )
}
