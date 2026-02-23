import { useEffect, useState } from 'react'
import { Sliders } from 'lucide-react'
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
} from 'recharts'
import {
  getDistributedEnergyResourceManagementDashboard,
  DERMDashboard,
} from '../api/client'

const DER_TYPE_COLORS: Record<string, string> = {
  'Rooftop Solar':      '#f59e0b',
  'Home Battery':       '#6366f1',
  'VPP Battery':        '#8b5cf6',
  'EV Charger V2G':     '#22c55e',
  'Smart Appliance':    '#06b6d4',
  'Controllable Hot Water': '#3b82f6',
  'HVAC':               '#ec4899',
  'Commercial Solar':   '#f97316',
  'Commercial Battery': '#a855f7',
  'Microgrid':          '#10b981',
}

const MANDATE_COLORS: Record<string, string> = {
  'Mandated':         '#ef4444',
  'Proposed Mandate': '#f59e0b',
  'Voluntary':        '#22c55e',
}

const SCENARIO_COLORS: Record<string, string> = {
  'Current':           '#94a3b8',
  'Two-Sided Market':  '#6366f1',
  'Full CER':          '#22c55e',
}

export default function DistributedEnergyResourceManagementAnalytics() {
  const [data, setData] = useState<DERMDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDistributedEnergyResourceManagementDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading DERM Analytics...</div>
  if (error)   return <div className="p-8 text-center text-red-400">Error: {error}</div>
  if (!data)   return null

  const { assets, aggregators, dispatch_events, programs, interoperability, projections, summary } = data

  // Chart 1: DER Asset Capacity by Type — stacked bar, total_capacity_mw by der_type × state
  const assetStateMap: Record<string, Record<string, number>> = {}
  const derTypes = Array.from(new Set(assets.map(a => a.der_type)))
  for (const a of assets) {
    if (!assetStateMap[a.state]) assetStateMap[a.state] = {}
    assetStateMap[a.state][a.der_type] = (assetStateMap[a.state][a.der_type] || 0) + a.total_capacity_mw
  }
  const assetChartData = Object.entries(assetStateMap).map(([state, types]) => ({ state, ...types }))

  // Chart 2: Aggregator Market Participation — horizontal bar, sorted by controllable_capacity_mw
  const aggChartData = [...aggregators]
    .sort((a, b) => b.controllable_capacity_mw - a.controllable_capacity_mw)
    .map(a => ({
      name: a.aggregator_name.length > 24 ? a.aggregator_name.slice(0, 22) + '…' : a.aggregator_name,
      controllable_capacity_mw: a.controllable_capacity_mw,
    }))

  // Chart 3: Dispatch Events Trend — line, energy_dispatched_mwh and response_success_rate by month
  const dispatchChartData = dispatch_events.map(d => ({
    month: d.month,
    energy_mwh: d.energy_dispatched_mwh,
    success_rate: d.response_success_rate_pct,
  }))

  // Chart 4: Program Performance — grouped bar, capacity_mw and benefit_cost_ratio
  const programChartData = programs
    .filter(p => p.capacity_mw > 0)
    .map(p => ({
      name: p.program_name.length > 22 ? p.program_name.slice(0, 20) + '…' : p.program_name,
      capacity_mw: p.capacity_mw,
      benefit_cost_ratio: p.benefit_cost_ratio,
    }))

  // Chart 5: Protocol Adoption — bar, market_adoption_pct by standard_name coloured by mandate_status
  const protoChartData = [...interoperability]
    .sort((a, b) => b.market_adoption_pct - a.market_adoption_pct)
    .map(i => ({
      name: i.standard_name,
      adoption_pct: i.market_adoption_pct,
      mandate: i.mandate_status,
    }))

  // Chart 6: Projection — line, controllable_capacity_gw for 3 scenarios 2024-2035
  const projByYear: Record<number, Record<string, number>> = {}
  for (const p of projections) {
    if (!projByYear[p.year]) projByYear[p.year] = { year: p.year }
    projByYear[p.year][p.scenario] = p.controllable_capacity_gw
  }
  const projChartData = Object.values(projByYear).sort((a, b) => a.year - b.year)

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sliders className="text-indigo-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Distributed Energy Resource Management Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">
            DERMS orchestration — solar, batteries, EV chargers, controllable loads; VPP aggregation; two-sided markets; CER strategy
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Total Controllable Capacity</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">
            {summary.total_controllable_capacity_mw.toLocaleString()} MW
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Registered Aggregators</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {summary.registered_aggregators}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Avg Dispatch Success</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {summary.avg_dispatch_success_rate_pct}%
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Projected 2030 Capacity</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {summary.projected_2030_controllable_gw} GW
          </div>
        </div>
      </div>

      {/* Chart 1: DER Asset Capacity by Type */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">DER Asset Capacity by Type (MW) — by State</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={assetChartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} />
            <Legend />
            {derTypes.map(dt => (
              <Bar key={dt} dataKey={dt} stackId="a" fill={DER_TYPE_COLORS[dt] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Aggregator Market Participation */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Aggregator Controllable Capacity (MW)</h2>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart
            layout="vertical"
            data={aggChartData}
            margin={{ top: 10, right: 30, left: 170, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" />
            <YAxis dataKey="name" type="category" stroke="#9ca3af" width={160} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} />
            <Bar dataKey="controllable_capacity_mw" fill="#6366f1" name="Controllable Capacity (MW)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Dispatch Events Trend */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Dispatch Events Trend — Energy Dispatched & Success Rate</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dispatchChartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={55} />
            <YAxis yAxisId="left" stroke="#9ca3af" />
            <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" domain={[70, 100]} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="energy_mwh" stroke="#f59e0b" name="Energy Dispatched (MWh)" dot={false} strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="success_rate" stroke="#22c55e" name="Response Success Rate (%)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Program Performance */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Program Performance — Capacity &amp; Benefit-Cost Ratio</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={programChartData} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={70} />
            <YAxis yAxisId="left" stroke="#9ca3af" />
            <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" domain={[0, 7]} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} />
            <Legend />
            <Bar yAxisId="left" dataKey="capacity_mw" fill="#6366f1" name="Capacity (MW)" />
            <Bar yAxisId="right" dataKey="benefit_cost_ratio" fill="#22c55e" name="Benefit-Cost Ratio" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Protocol Adoption */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Protocol &amp; Standard Adoption (%) — by Mandate Status</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={protoChartData} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={80} />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(val: number, _name: string, props: any) => [
                `${val}% — ${props.payload.mandate}`,
                'Market Adoption',
              ]}
            />
            <Bar
              dataKey="adoption_pct"
              name="Market Adoption (%)"
              isAnimationActive={false}
            >
              {protoChartData.map((entry, idx) => (
                <rect
                  key={idx}
                  fill={MANDATE_COLORS[entry.mandate] ?? '#6b7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 justify-center text-xs">
          {Object.entries(MANDATE_COLORS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span style={{ background: v, width: 12, height: 12, display: 'inline-block', borderRadius: 2 }} />
              <span className="text-gray-400">{k}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Chart 6: Projection — Controllable Capacity */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Projection: Controllable Capacity (GW) 2024–2035</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={projChartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} />
            <Legend />
            {Object.entries(SCENARIO_COLORS).map(([sc, color]) => (
              <Line key={sc} type="monotone" dataKey={sc} stroke={color} name={sc} dot={{ r: 3 }} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Table */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Dashboard Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-gray-400">Total Controllable Capacity</dt>
            <dd className="text-base font-semibold text-gray-100">{summary.total_controllable_capacity_mw.toLocaleString()} MW</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Registered Aggregators</dt>
            <dd className="text-base font-semibold text-gray-100">{summary.registered_aggregators}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Avg Dispatch Success Rate</dt>
            <dd className="text-base font-semibold text-gray-100">{summary.avg_dispatch_success_rate_pct}%</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Total Market Value</dt>
            <dd className="text-base font-semibold text-gray-100">${(summary.total_market_value_b * 1000).toFixed(1)}M / yr</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Projected 2030 Controllable (2SM)</dt>
            <dd className="text-base font-semibold text-gray-100">{summary.projected_2030_controllable_gw} GW</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Leading Protocol</dt>
            <dd className="text-base font-semibold text-gray-100">{summary.leading_protocol}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
