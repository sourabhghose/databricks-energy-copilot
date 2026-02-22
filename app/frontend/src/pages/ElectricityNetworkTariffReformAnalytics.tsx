import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, AlertTriangle, BarChart2 } from 'lucide-react'
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
  Cell,
} from 'recharts'
import {
  getElectricityNetworkTariffReformDashboard,
  ENTRDashboard,
  ENTRTariffStructureRecord,
  ENTRCostAllocationRecord,
  ENTRCrossSubsidyRecord,
  ENTRReformScenarioRecord,
  ENTRPeakDemandRecord,
  ENTREquityRecord,
} from '../api/client'

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

const COLOURS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ElectricityNetworkTariffReformAnalytics() {
  const [data, setData] = useState<ENTRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getElectricityNetworkTariffReformDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm animate-pulse">Loading Network Tariff Reform data…</div>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400 text-sm">{error ?? 'No data available'}</div>
      </div>
    )
  }

  const { tariff_structures, cost_allocations, cross_subsidies, reform_scenarios, peak_demand, equity_analysis, summary } = data

  // ── Chart 1: Tariff Structure Comparison ───────────────────────────────────
  const tariffChartData = tariff_structures.map((r: ENTRTariffStructureRecord) => ({
    name: `${r.dnsp} ${r.tariff_type}`,
    'Supply Charge (c/day)': r.daily_supply_charge_cents,
    'Peak Energy (c/kWh)': r.energy_charge_peak_cents_kwh,
    'Off-Peak Energy (c/kWh)': r.energy_charge_offpeak_cents_kwh,
  }))

  // ── Chart 2: Cost Allocation vs Recovery ──────────────────────────────────
  const costCategoryMap: Record<string, { allocated: number; recovered: number }> = {}
  cost_allocations.forEach((r: ENTRCostAllocationRecord) => {
    if (!costCategoryMap[r.cost_category]) costCategoryMap[r.cost_category] = { allocated: 0, recovered: 0 }
    costCategoryMap[r.cost_category].allocated += r.allocated_cost_m
    costCategoryMap[r.cost_category].recovered += r.recovered_cost_m
  })
  const costChartData = Object.entries(costCategoryMap).map(([cat, vals]) => ({
    name: cat,
    'Allocated ($M)': Math.round(vals.allocated),
    'Recovered ($M)': Math.round(vals.recovered),
  }))

  // ── Chart 3: Cross-Subsidy Flows ──────────────────────────────────────────
  const crossSubsidyChartData = cross_subsidies
    .slice(0, 10)
    .map((r: ENTRCrossSubsidyRecord) => ({
      name: `${r.from_segment} → ${r.to_segment}`,
      'Annual Subsidy ($M)': r.annual_subsidy_m,
    }))
    .sort((a, b) => b['Annual Subsidy ($M)'] - a['Annual Subsidy ($M)'])

  // ── Chart 4: Reform Scenario Impact ───────────────────────────────────────
  const scenarioNames = [...new Set(reform_scenarios.map((r: ENTRReformScenarioRecord) => r.scenario))]
  const segmentNames  = [...new Set(reform_scenarios.map((r: ENTRReformScenarioRecord) => r.customer_segment))]
  const scenarioChartData = scenarioNames.map((sc) => {
    const entry: Record<string, string | number> = { scenario: sc }
    segmentNames.forEach((seg) => {
      const match = reform_scenarios.find(
        (r: ENTRReformScenarioRecord) => r.scenario === sc && r.customer_segment === seg
      )
      entry[seg] = match ? match.annual_bill_change_pct : 0
    })
    return entry
  })

  // ── Chart 5: Peak Demand Trend ────────────────────────────────────────────
  // Aggregate by month across regions
  const monthMap: Record<string, { peak: number; util: number; count: number }> = {}
  peak_demand.forEach((r: ENTRPeakDemandRecord) => {
    if (!monthMap[r.month]) monthMap[r.month] = { peak: 0, util: 0, count: 0 }
    monthMap[r.month].peak += r.peak_demand_mw
    monthMap[r.month].util += r.network_utilisation_pct
    monthMap[r.month].count += 1
  })
  const peakChartData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({
      month: month.slice(2),  // shorten to YY-MM
      'Peak Demand (MW)': Math.round(vals.peak / vals.count),
      'Network Utilisation (%)': Math.round((vals.util / vals.count) * 10) / 10,
    }))

  // ── Chart 6: Equity Analysis ──────────────────────────────────────────────
  const equityChartData = equity_analysis
    .map((r: ENTREquityRecord) => ({
      segment: r.segment.length > 20 ? r.segment.slice(0, 20) + '…' : r.segment,
      'Net Position ($)': r.net_position_aud,
    }))
    .sort((a, b) => b['Net Position ($)'] - a['Net Position ($)'])

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-white">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-2">
        <DollarSign size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Electricity Network Tariff Reform Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Cost-reflective pricing, peak demand tariffs, cross-subsidies &amp; AEMC reform directions
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Network Revenue"
          value={`$${Number(summary.total_network_revenue_m).toFixed(0)}M`}
          sub="Across all DNSPs"
          icon={DollarSign}
          colour="bg-amber-500"
        />
        <KpiCard
          label="Avg Under-Recovery"
          value={`${Number(summary.avg_under_recovery_pct).toFixed(1)}%`}
          sub="Fixed network costs not recovered"
          icon={AlertTriangle}
          colour="bg-red-600"
        />
        <KpiCard
          label="Largest Cross-Subsidy"
          value={`$${Number(summary.largest_cross_subsidy_m).toFixed(1)}M`}
          sub="Single DNSP/segment pair"
          icon={TrendingUp}
          colour="bg-purple-600"
        />
        <KpiCard
          label="Low-Income Annual Bill"
          value={`$${Number(summary.low_income_annual_bill_aud).toFixed(0)}`}
          sub="No-solar household"
          icon={BarChart2}
          colour="bg-blue-600"
        />
      </div>

      {/* Chart 1: Tariff Structure Comparison */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Tariff Structure Comparison"
          subtitle="Daily supply charge and peak energy charge by DNSP and tariff type"
        />
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={tariffChartData} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-45} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Supply Charge (c/day)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Peak Energy (c/kWh)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Off-Peak Energy (c/kWh)" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Cost Allocation vs Recovery */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Network Cost Allocation vs Recovery"
          subtitle="Total allocated vs actually recovered costs by cost category ($M)"
        />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={costChartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="Allocated ($M)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Recovered ($M)" fill="#06b6d4" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Cross-Subsidy Flows */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Cross-Subsidy Flows"
          subtitle="Annual implicit subsidy from one consumer segment to another ($M) — top 10 pairs"
        />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            layout="vertical"
            data={crossSubsidyChartData}
            margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis type="category" dataKey="name" width={195} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }} />
            <Bar dataKey="Annual Subsidy ($M)" radius={[0, 3, 3, 0]}>
              {crossSubsidyChartData.map((_, i) => (
                <Cell key={i} fill={COLOURS[i % COLOURS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Reform Scenario Impact */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Reform Scenario Bill Impact"
          subtitle="Annual bill change (%) by reform scenario and customer segment (negative = bill reduction)"
        />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={scenarioChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="scenario" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }}
              formatter={(value: number) => [`${value.toFixed(1)}%`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {segmentNames.map((seg, i) => (
              <Bar key={seg} dataKey={seg} fill={COLOURS[i % COLOURS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Peak Demand Trend */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Peak Demand Trend"
          subtitle="Monthly average peak demand (MW) and network utilisation (%) across NEM regions"
        />
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={peakChartData} margin={{ top: 5, right: 40, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-30} textAnchor="end" interval={2} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="Peak Demand (MW)" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="Network Utilisation (%)" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Equity Analysis */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Equity Analysis — Net Position by Consumer Segment"
          subtitle="Net tariff position (solar benefit minus cross-subsidy paid, $AUD/year). Green = net benefit, Red = net cost."
        />
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            layout="vertical"
            data={equityChartData}
            margin={{ top: 5, right: 30, left: 220, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
            <YAxis type="category" dataKey="segment" width={215} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }}
              formatter={(value: number) => [`$${value.toLocaleString()}`]}
            />
            <Bar dataKey="Net Position ($)" radius={[0, 3, 3, 0]}>
              {equityChartData.map((d, i) => (
                <Cell key={i} fill={d['Net Position ($)'] >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-500 mt-3">
          Best reform scenario per model: <span className="text-amber-400 font-medium">{String(summary.best_reform_scenario)}</span>.
          Average peak demand network utilisation: <span className="text-blue-400 font-medium">{Number(summary.avg_peak_demand_utilisation_pct).toFixed(1)}%</span>.
        </p>
      </div>
    </div>
  )
}
