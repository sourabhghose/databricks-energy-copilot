import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  getCostReflectiveTariffReformDashboard,
  CTRDashboard,
  CTRTariffStructureRecord,
  CTRReformTimelineRecord,
  CTRCustomerBillImpactRecord,
  CTRPeakContributionRecord,
  CTRDERTariffRecord,
} from '../api/client'
import { BarChart2, TrendingDown, Activity, Zap, DollarSign } from 'lucide-react'

// ---- Colour maps ----------------------------------------------------------------

const TARIFF_TYPE_COLOURS: Record<string, string> = {
  FLAT:     '#6b7280',
  TOU:      '#3b82f6',
  DEMAND:   '#f59e0b',
  CAPACITY: '#10b981',
  DYNAMIC:  '#8b5cf6',
}

const TARIFF_TYPE_BADGE: Record<string, string> = {
  FLAT:     'bg-gray-500/20 text-gray-300 border border-gray-500/40',
  TOU:      'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  DEMAND:   'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  CAPACITY: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  DYNAMIC:  'bg-violet-500/20 text-violet-300 border border-violet-500/40',
}

const AER_STATUS_BADGE: Record<string, string> = {
  PENDING:     'bg-gray-500/20 text-gray-300 border border-gray-500/40',
  APPROVED:    'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  COMPLETED:   'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
}

const DER_COLOURS: Record<string, string> = {
  SOLAR_PV:  '#f59e0b',
  BATTERY:   '#06b6d4',
  EV:        '#8b5cf6',
  HEAT_PUMP: '#10b981',
}

const DISTRIBUTOR_COLOURS: Record<string, string> = {
  Ausgrid:   '#3b82f6',
  Endeavour: '#f59e0b',
  Essential: '#10b981',
  SAPN:      '#8b5cf6',
  Powercor:  '#f43f5e',
}

// ---- KPI Card ------------------------------------------------------------------

function KpiCard({ label, value, sub, icon: Icon, colour }: {
  label: string; value: string; sub?: string; icon: React.ElementType; colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ---- Tariff Structure Table ----------------------------------------------------

function TariffStructureTable({ records }: { records: CTRTariffStructureRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">Tariff Structure Overview</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {['Distributor', 'State', 'Customer Class', 'Tariff Type', 'Peak (¢/kWh)',
                'Off-Peak (¢/kWh)', 'Demand ($/kW/mo)', 'Daily Supply ($)',
                'Customers', 'Opt-In %'].map(h => (
                <th key={h} className="text-left text-xs text-gray-400 pb-2 pr-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                <td className="py-2 pr-3 text-white font-medium whitespace-nowrap">{r.distributor}</td>
                <td className="py-2 pr-3 text-gray-300">{r.state}</td>
                <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{r.tariff_class}</td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TARIFF_TYPE_BADGE[r.tariff_type] ?? 'bg-gray-600/20 text-gray-300'}`}>
                    {r.tariff_type}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-gray-200">{r.peak_rate_c_per_kwh.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right text-gray-200">{r.off_peak_rate_c_per_kwh.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right text-gray-200">
                  {r.demand_charge_per_kw_month > 0 ? r.demand_charge_per_kw_month.toFixed(2) : '—'}
                </td>
                <td className="py-2 pr-3 text-right text-gray-200">{r.daily_supply_charge.toFixed(4)}</td>
                <td className="py-2 pr-3 text-right text-gray-200">{r.customer_count.toLocaleString()}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-gray-700 rounded-full h-1.5 w-12">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(r.opt_in_rate_pct, 100)}%`,
                          backgroundColor: TARIFF_TYPE_COLOURS[r.tariff_type] ?? '#6b7280',
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-300 w-9 text-right">{r.opt_in_rate_pct.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Reform Timeline (Gantt-style table) ----------------------------------------

function ReformTimeline({ records }: { records: CTRReformTimelineRecord[] }) {
  const minYear = Math.min(...records.map(r => r.start_year))
  const maxYear = Math.max(...records.map(r => r.end_year))
  const totalSpan = maxYear - minYear

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">AER Reform Timeline by Phase</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {['Distributor', 'Phase', 'Timeline', 'Target Customers', 'Key Change',
                'Cost Reflectivity', 'AER Status'].map(h => (
                <th key={h} className="text-left text-xs text-gray-400 pb-2 pr-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const barStart = ((r.start_year - minYear) / totalSpan) * 100
              const barWidth = ((r.end_year - r.start_year) / totalSpan) * 100
              const scoreColour = r.cost_reflectivity_score >= 8 ? '#10b981'
                : r.cost_reflectivity_score >= 7 ? '#3b82f6'
                : '#f59e0b'
              return (
                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                  <td className="py-2.5 pr-3 text-white font-medium whitespace-nowrap">{r.distributor}</td>
                  <td className="py-2.5 pr-3 text-gray-300 whitespace-nowrap">{r.reform_phase.replace('_', ' ')}</td>
                  <td className="py-2.5 pr-3 w-40">
                    <div className="relative bg-gray-700 rounded h-5 w-36">
                      <div
                        className="absolute top-0 h-5 rounded flex items-center justify-center"
                        style={{
                          left: `${barStart}%`,
                          width: `${barWidth}%`,
                          backgroundColor: DISTRIBUTOR_COLOURS[r.distributor] ?? '#6b7280',
                          opacity: 0.8,
                        }}
                      >
                        <span className="text-xs text-white font-medium whitespace-nowrap px-1 truncate">
                          {r.start_year}–{r.end_year}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-300 text-xs max-w-xs">{r.target_customers}</td>
                  <td className="py-2.5 pr-3 text-gray-400 text-xs max-w-xs">{r.key_change}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-gray-700 rounded-full h-1.5 w-16">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${(r.cost_reflectivity_score / 10) * 100}%`, backgroundColor: scoreColour }}
                        />
                      </div>
                      <span className="text-xs text-gray-300">{r.cost_reflectivity_score.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${AER_STATUS_BADGE[r.aer_approval_status] ?? 'bg-gray-600/20 text-gray-300'}`}>
                      {r.aer_approval_status.replace('_', ' ')}
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

// ---- Bill Impact BarChart -------------------------------------------------------

function BillImpactChart({ records }: { records: CTRCustomerBillImpactRecord[] }) {
  const data = records.map(r => ({
    name: `${r.customer_type}\n${r.tariff_from}→${r.tariff_to}`,
    label: `${r.tariff_from}→${r.tariff_to}`,
    type: r.customer_type,
    Before: r.avg_annual_bill_before,
    After: r.avg_annual_bill_after,
    'Flex Saving': r.flexibility_benefit,
    'Solar Saving': r.solar_impact,
    change: r.bill_change_pct,
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-1">Bill Impact Analysis — Tariff Transitions</h2>
      <p className="text-xs text-gray-400 mb-4">Average annual bill ($/yr) before and after tariff transition per customer type</p>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} margin={{ left: 20, right: 12, top: 8, bottom: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            itemStyle={{ color: '#d1d5db' }}
            formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name]}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: '12px' }} />
          <Bar dataKey="Before" fill="#6b7280" radius={[3, 3, 0, 0]} />
          <Bar dataKey="After"  fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Flex Saving" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Solar Saving" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---- Peak Contribution vs Cost Allocation ---------------------------------------

function PeakVsCostChart({ records }: { records: CTRPeakContributionRecord[] }) {
  // Group by distributor for side-by-side comparison
  const distributors = [...new Set(records.map(r => r.distributor))]
  const segments = [...new Set(records.map(r => r.customer_segment))]

  const chartData = segments.map(seg => {
    const row: Record<string, string | number> = { segment: seg }
    distributors.forEach(d => {
      const rec = records.find(r => r.distributor === d && r.customer_segment === seg)
      if (rec) {
        row[`${d} Peak%`] = rec.peak_contribution_pct
        row[`${d} Cost%`] = rec.cost_allocation_pct
      }
    })
    return row
  })

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-1">Peak Contribution vs Cost Allocation</h2>
      <p className="text-xs text-gray-400 mb-4">
        Positive equity gap = segment under-contributes to peak but over-pays network cost (cross-subsidy)
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bar comparison chart */}
        <div>
          <h3 className="text-sm text-gray-300 mb-3">Peak % vs Cost Allocation % by Segment (Ausgrid)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={records.filter(r => r.distributor === 'Ausgrid')}
              margin={{ left: 0, right: 12, top: 8, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="customer_segment" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 60]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#d1d5db' }}
                formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              <Bar dataKey="peak_contribution_pct" name="Peak Contribution %" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="cost_allocation_pct"   name="Cost Allocation %"   fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Equity gap table */}
        <div>
          <h3 className="text-sm text-gray-300 mb-3">Equity Gap by Distributor & Segment</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 pb-2 pr-2">Distributor</th>
                  <th className="text-left text-gray-400 pb-2 pr-2">Segment</th>
                  <th className="text-right text-gray-400 pb-2 pr-2">Peak %</th>
                  <th className="text-right text-gray-400 pb-2 pr-2">Cost %</th>
                  <th className="text-right text-gray-400 pb-2">Gap %</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const gapColour = r.equity_gap_pct > 8 ? 'text-red-400'
                    : r.equity_gap_pct > 4 ? 'text-amber-400'
                    : r.equity_gap_pct < -2 ? 'text-emerald-400'
                    : 'text-gray-300'
                  return (
                    <tr key={i} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                      <td className="py-1.5 pr-2 text-white font-medium">{r.distributor}</td>
                      <td className="py-1.5 pr-2 text-gray-300">{r.customer_segment}</td>
                      <td className="py-1.5 pr-2 text-right text-gray-300">{r.peak_contribution_pct.toFixed(1)}%</td>
                      <td className="py-1.5 pr-2 text-right text-gray-300">{r.cost_allocation_pct.toFixed(1)}%</td>
                      <td className={`py-1.5 text-right font-semibold ${gapColour}`}>
                        {r.equity_gap_pct > 0 ? '+' : ''}{r.equity_gap_pct.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- DER Tariff Penetration LineChart -------------------------------------------

function DERTariffPenetrationChart({ records }: { records: CTRDERTariffRecord[] }) {
  const quarters = [...new Set(records.map(r => r.quarter))].sort()
  const states   = [...new Set(records.map(r => r.state))]
  const derTypes = [...new Set(records.map(r => r.der_type))]

  // One chart per DER type, showing penetration by state over quarters
  const chartsByDer = derTypes.map(der => {
    const data = quarters.map(q => {
      const row: Record<string, string | number> = { quarter: q }
      states.forEach(st => {
        const rec = records.find(r => r.state === st && r.quarter === q && r.der_type === der)
        if (rec) row[st] = rec.penetration_pct
      })
      return row
    })
    return { der, data }
  })

  const stateColours: Record<string, string> = {
    NSW: '#3b82f6', VIC: '#10b981', SA: '#f59e0b', QLD: '#8b5cf6', WA: '#f43f5e',
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-1">DER Penetration by Type & State</h2>
      <p className="text-xs text-gray-400 mb-4">Penetration % of DER technology by state over quarters</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {chartsByDer.map(({ der, data }) => (
          <div key={der}>
            <h3 className="text-sm text-gray-300 mb-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                style={{ backgroundColor: DER_COLOURS[der] ?? '#6b7280' }}
              />
              {der.replace('_', ' ')}
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#f3f4f6' }}
                  itemStyle={{ color: '#d1d5db' }}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '11px' }} />
                {states.map(st => (
                  <Line
                    key={st}
                    type="monotone"
                    dataKey={st}
                    stroke={stateColours[st] ?? '#6b7280'}
                    strokeWidth={2}
                    dot={{ r: 4, fill: stateColours[st] ?? '#6b7280' }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
      {/* Export tariff and constraint events summary table */}
      <div className="mt-6">
        <h3 className="text-sm text-gray-300 mb-3">DER Export Tariff & Network Constraint Events (Latest Quarter)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                {['State', 'DER Type', 'Quarter', 'Export Tariff (¢/kWh)', 'Two-Way Tariff', 'Hosting Cap %', 'Constraint Events/mo'].map(h => (
                  <th key={h} className="text-left text-gray-400 pb-2 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records
                .filter(r => r.quarter === quarters[quarters.length - 1])
                .map((r, i) => (
                  <tr key={i} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                    <td className="py-1.5 pr-3 text-white font-medium">{r.state}</td>
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: DER_COLOURS[r.der_type] ?? '#6b7280' }}
                        />
                        <span className="text-gray-300">{r.der_type.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-gray-400">{r.quarter}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-200">
                      {r.export_tariff_c_per_kwh > 0 ? r.export_tariff_c_per_kwh.toFixed(2) : '—'}
                    </td>
                    <td className="py-1.5 pr-3">
                      {r.two_way_tariff_implemented
                        ? <span className="text-emerald-400 font-medium">Yes</span>
                        : <span className="text-gray-500">No</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-gray-200">{r.network_hosting_capacity_pct.toFixed(1)}%</td>
                    <td className="py-1.5 pr-3 text-right">
                      <span className={r.constraint_events_per_month > 8 ? 'text-red-400 font-semibold' : r.constraint_events_per_month > 4 ? 'text-amber-400' : 'text-gray-300'}>
                        {r.constraint_events_per_month}
                      </span>
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

// ---- Main Page Component --------------------------------------------------------

export default function CostReflectiveTariffReformAnalytics() {
  const [data, setData] = useState<CTRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCostReflectiveTariffReformDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading Cost-Reflective Tariff Reform data…</div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-sm">Error: {error ?? 'No data'}</div>
      </div>
    )
  }

  const s = data.summary as Record<string, number>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
          <BarChart2 className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Cost-Reflective Tariff Reform Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            TOU, capacity &amp; DER integration tariff reform — AER regulatory framework, bill impacts &amp; network equity
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Avg TOU Opt-In Rate"
          value={`${s.avg_opt_in_rate_pct}%`}
          sub="of eligible customers"
          icon={Activity}
          colour="bg-blue-500/20 text-blue-400"
        />
        <KpiCard
          label="Distributors w/ Mandatory TOU"
          value={`${s.distributors_with_tou_mandatory}`}
          sub="out of 5 major distributors"
          icon={BarChart2}
          colour="bg-emerald-500/20 text-emerald-400"
        />
        <KpiCard
          label="Avg Equity Gap"
          value={`${s.avg_equity_gap_pct}%`}
          sub="cross-subsidy misalignment"
          icon={TrendingDown}
          colour="bg-red-500/20 text-red-400"
        />
        <KpiCard
          label="Avg DER Penetration"
          value={`${s.der_penetration_avg_pct}%`}
          sub="across all DER types"
          icon={Zap}
          colour="bg-amber-500/20 text-amber-400"
        />
        <KpiCard
          label="Customers on Capacity Tariff"
          value={`${s.total_customers_on_capacity_tariff_k}k`}
          sub="total enrolled"
          icon={DollarSign}
          colour="bg-violet-500/20 text-violet-400"
        />
      </div>

      {/* Tariff Structure Table */}
      <TariffStructureTable records={data.tariff_structures} />

      {/* Reform Timeline */}
      <ReformTimeline records={data.reform_timeline} />

      {/* Bill Impact */}
      <BillImpactChart records={data.bill_impacts} />

      {/* Peak Contribution vs Cost Allocation */}
      <PeakVsCostChart records={data.peak_contributions} />

      {/* DER Tariff Penetration */}
      <DERTariffPenetrationChart records={data.der_tariffs} />
    </div>
  )
}
