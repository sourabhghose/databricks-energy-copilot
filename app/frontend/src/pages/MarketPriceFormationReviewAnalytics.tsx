import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
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
  getMarketPriceFormationReviewDashboard,
  MPFRDashboard,
} from '../api/client'

const REGION_COLORS: Record<string, string> = {
  NSW: '#6366f1',
  VIC: '#22c55e',
  QLD: '#f59e0b',
  SA:  '#ef4444',
  TAS: '#06b6d4',
  WEM: '#a855f7',
}

const SCARCITY_COLORS: Record<string, string> = {
  'Lack of Reserve 1': '#fbbf24',
  'LOR2':              '#f97316',
  'LOR3':              '#ef4444',
  'Pre-LOR':           '#84cc16',
  'Emergency':         '#dc2626',
  'VoLL':              '#7c3aed',
  'RERT':              '#0ea5e9',
  'Voluntary':         '#10b981',
  'Market Suspended':  '#111827',
}

const STAGE_COLORS: Record<string, string> = {
  'Rule Change Determination': '#22c55e',
  'Draft Rule':                '#84cc16',
  'Consultation Paper':        '#f59e0b',
  'Issues Paper':              '#f97316',
  'Proposal':                  '#6366f1',
  'Review Final Report':       '#3b82f6',
  'Policy Direction':          '#a855f7',
  'Draft Guideline':           '#06b6d4',
  'Policy Statement':          '#10b981',
  'Draft Standard':            '#8b5cf6',
  'Submission':                '#94a3b8',
  'Discussion Paper':          '#64748b',
  'Final Decision':            '#15803d',
}

const COST_COLORS: Record<string, string> = {
  fuel_cost_contribution_mwh:    '#f59e0b',
  carbon_cost_contribution_mwh:  '#6366f1',
  capacity_adequacy_premium_mwh: '#3b82f6',
  scarcity_premium_mwh:          '#ef4444',
}

export default function MarketPriceFormationReviewAnalytics() {
  const [data, setData] = useState<MPFRDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMarketPriceFormationReviewDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading Market Price Formation Review Analytics...</div>
  if (error)   return <div className="p-8 text-center text-red-400">Error: {error}</div>
  if (!data)   return null

  const { price_caps, scarcity_events, vcr_values, reforms, marginal_costs, demand_side, summary } = data

  // Chart 1: Price Cap Levels — MPC/APC/VoLL by year (NSW only for clarity)
  const pcNSW = price_caps.filter(r => r.region === 'NSW').sort((a, b) => a.year - b.year)
  const priceCapChartData = pcNSW.map(r => ({
    year: r.year,
    'Market Price Cap (MPC)': r.market_price_cap_mwh,
    'Administered Price Cap (APC)': r.administered_price_cap_mwh,
    'Value of Lost Load (VoLL)': r.voll_mwh,
  }))

  // Chart 2: Scarcity Events — count and cost by region × scarcity_type
  const scarcityByRegion: Record<string, Record<string, number>> = {}
  const scarcityTypes = Array.from(new Set(scarcity_events.map(e => e.scarcity_type)))
  for (const e of scarcity_events) {
    if (!scarcityByRegion[e.region]) scarcityByRegion[e.region] = {}
    scarcityByRegion[e.region][e.scarcity_type] = (scarcityByRegion[e.region][e.scarcity_type] || 0) + 1
  }
  const scarcityChartData = Object.entries(scarcityByRegion).map(([region, types]) => ({ region, ...types }))

  // Chart 3: VCR by Customer Class — horizontal bar, vcr_aud_per_mwh by class × state
  const vcrByClass: Record<string, Record<string, number>> = {}
  const states = Array.from(new Set(vcr_values.map(v => v.state)))
  for (const v of vcr_values) {
    if (!vcrByClass[v.customer_class]) vcrByClass[v.customer_class] = {}
    vcrByClass[v.customer_class][v.state] = v.vcr_aud_per_mwh
  }
  const vcrChartData = Object.entries(vcrByClass).map(([cc, sv]) => ({ customer_class: cc, ...sv }))

  // Chart 4: Reform Pipeline — horizontal bar, financial_impact_consumer_m by reform_name
  const reformChartData = reforms
    .filter(r => r.outcome !== 'Rejected')
    .sort((a, b) => a.financial_impact_consumer_m - b.financial_impact_consumer_m)
    .map(r => ({
      name: r.reform_name.length > 32 ? r.reform_name.slice(0, 30) + '…' : r.reform_name,
      consumer_impact: Math.abs(r.financial_impact_consumer_m),
      stage: r.consultation_stage,
    }))

  // Chart 5: Marginal Cost Decomposition — stacked bar (NSW quarterly)
  const mcNSW = marginal_costs.filter(r => r.region === 'NSW').sort((a, b) => a.quarter.localeCompare(b.quarter))
  const mcChartData = mcNSW.map(r => ({
    quarter: r.quarter,
    fuel_cost_contribution_mwh: r.fuel_cost_contribution_mwh,
    carbon_cost_contribution_mwh: r.carbon_cost_contribution_mwh,
    capacity_adequacy_premium_mwh: r.capacity_adequacy_premium_mwh,
    scarcity_premium_mwh: r.scarcity_premium_mwh,
    actual_spot_price_mwh: r.actual_spot_price_mwh,
  }))

  // Chart 6: Demand Response Capacity — line by year × region
  const drByYear: Record<number, Record<string, number>> = {}
  const drRegions = Array.from(new Set(demand_side.map(d => d.region)))
  for (const d of demand_side) {
    if (!drByYear[d.year]) drByYear[d.year] = { year: d.year }
    drByYear[d.year][d.region] = d.demand_response_capacity_mw
  }
  const drChartData = Object.values(drByYear).sort((a, b) => a.year - b.year)

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertCircle className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Market Price Formation Review Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">
            AEMC 2023-24 Price Formation Review — MPC, APC, CPT, VoLL, scarcity pricing, VCR, demand-side participation
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Current MPC</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            ${summary.current_mpc_mwh.toLocaleString()}/MWh
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">APC Activations YTD</div>
          <div className="text-2xl font-bold text-red-400 mt-1">
            {summary.total_apc_activations_ytd}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Total Scarcity Cost</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">
            ${summary.total_scarcity_cost_m.toFixed(1)}M
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Residential VCR</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            ${(summary.avg_vcr_residential_aud_per_mwh / 1000).toFixed(0)}k/MWh
          </div>
        </div>
      </div>

      {/* Chart 1: Price Cap Levels */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Price Cap Levels ($/MWh) — NSW 2020–2024</h2>
        <p className="text-xs text-gray-400 mb-4">MPC currently $17,500/MWh; APC $300/MWh; VoLL ~$15,100/MWh</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={priceCapChartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number, name: string) => [`$${v.toLocaleString()}/MWh`, name]}
            />
            <Legend />
            <Bar dataKey="Market Price Cap (MPC)" fill="#f59e0b" />
            <Bar dataKey="Value of Lost Load (VoLL)" fill="#6366f1" />
            <Bar dataKey="Administered Price Cap (APC)" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Scarcity Events by Region & Type */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Scarcity Events — Count by Region &amp; Type</h2>
        <p className="text-xs text-gray-400 mb-4">SA historically highest frequency; LOR2/LOR3 most common pre-RERT activation triggers</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={scarcityChartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} />
            <Legend />
            {scarcityTypes.map(st => (
              <Bar key={st} dataKey={st} stackId="a" fill={SCARCITY_COLORS[st] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: VCR by Customer Class */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Value of Customer Reliability ($/MWh) — by Customer Class &amp; State</h2>
        <p className="text-xs text-gray-400 mb-4">Deloitte 2022 methodology; residential VCR ~$85,000/MWh; critical infrastructure ~$1.2M/MWh</p>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            layout="vertical"
            data={vcrChartData}
            margin={{ top: 10, right: 30, left: 160, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              stroke="#9ca3af"
              tickFormatter={(v: number) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis dataKey="customer_class" type="category" stroke="#9ca3af" width={150} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number) => [`$${v.toLocaleString()}/MWh`]}
            />
            <Legend />
            {states.map(st => (
              <Bar key={st} dataKey={st} fill={REGION_COLORS[st] ?? '#6b7280'} name={st} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Reform Pipeline */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Reform Pipeline — Consumer Financial Impact ($M)</h2>
        <p className="text-xs text-gray-400 mb-4">Absolute consumer impact; coloured by consultation stage. Negative = consumer saving.</p>
        <ResponsiveContainer width="100%" height={520}>
          <BarChart
            layout="vertical"
            data={reformChartData}
            margin={{ top: 10, right: 30, left: 240, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" stroke="#9ca3af" tickFormatter={(v: number) => `$${v}M`} />
            <YAxis dataKey="name" type="category" stroke="#9ca3af" width={230} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number, _n: string, props: any) => [
                `$${v}M — ${props.payload.stage}`,
                'Consumer Impact',
              ]}
            />
            <Bar dataKey="consumer_impact" name="Consumer Impact ($M)" isAnimationActive={false}>
              {reformChartData.map((entry, idx) => (
                <rect key={idx} fill={STAGE_COLORS[entry.stage] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3 justify-center text-xs">
          {Object.entries(STAGE_COLORS).slice(0, 8).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span style={{ background: v, width: 10, height: 10, display: 'inline-block', borderRadius: 2 }} />
              <span className="text-gray-400">{k}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Chart 5: Marginal Cost Decomposition */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Marginal Cost Decomposition ($/MWh) — NSW Quarterly 2021–2024</h2>
        <p className="text-xs text-gray-400 mb-4">Stacked: fuel + carbon + adequacy premium + scarcity premium; line shows actual spot price</p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={mcChartData} margin={{ top: 10, right: 30, left: 20, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="quarter"
              stroke="#9ca3af"
              tick={{ fontSize: 9 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis stroke="#9ca3af" tickFormatter={(v: number) => `$${v}`} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number, name: string) => [`$${v.toFixed(2)}/MWh`, name]} />
            <Legend />
            {Object.entries(COST_COLORS).map(([key, color]) => (
              <Bar key={key} dataKey={key} stackId="a" fill={color} name={key.replace(/_/g, ' ').replace(' mwh', ' $/MWh')} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 6: Demand Response Capacity */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Demand Response Capacity (MW) — by Year &amp; Region</h2>
        <p className="text-xs text-gray-400 mb-4">DR capacity growth 2021–2024; NSW largest pool; SA fastest relative growth per capita</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={drChartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={(v: number) => `${v} MW`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number, name: string) => [`${v.toLocaleString()} MW`, name]}
            />
            <Legend />
            {drRegions.map(reg => (
              <Line
                key={reg}
                type="monotone"
                dataKey={reg}
                stroke={REGION_COLORS[reg] ?? '#6b7280'}
                name={reg}
                dot={{ r: 3 }}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Table */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Price Formation Review Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Current MPC (2024)</div>
            <div className="text-lg font-bold text-amber-400">${summary.current_mpc_mwh.toLocaleString()}/MWh</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">APC Activations YTD</div>
            <div className="text-lg font-bold text-red-400">{summary.total_apc_activations_ytd} events</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Total Scarcity Cost</div>
            <div className="text-lg font-bold text-orange-400">${summary.total_scarcity_cost_m.toFixed(1)}M</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Residential VCR (avg)</div>
            <div className="text-lg font-bold text-purple-400">${summary.avg_vcr_residential_aud_per_mwh.toLocaleString()}/MWh</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Active Reforms</div>
            <div className="text-lg font-bold text-blue-400">{summary.active_reforms_count}</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">DR Capacity (2024)</div>
            <div className="text-lg font-bold text-green-400">{summary.demand_response_capacity_mw.toLocaleString()} MW</div>
          </div>
        </div>
      </div>
    </div>
  )
}
