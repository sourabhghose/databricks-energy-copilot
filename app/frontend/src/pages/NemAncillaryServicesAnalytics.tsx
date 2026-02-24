import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getNemAncillaryServicesRegulationDashboard,
  NASRDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const SERVICE_TYPE_COLORS: Record<string, string> = {
  NSCAS:     '#3b82f6',
  SRAS:      '#10b981',
  RERT:      '#f59e0b',
  Emergency: '#ef4444',
}

const PROVIDER_TYPE_COLORS: Record<string, string> = {
  Generator:        '#3b82f6',
  Network:          '#10b981',
  DNSP:             '#f59e0b',
  Battery:          '#8b5cf6',
  Aggregator:       '#06b6d4',
  'Demand Response':'#f97316',
}

const OUTCOME_COLORS: Record<string, string> = {
  Successful: '#10b981',
  Partial:    '#f59e0b',
  Failed:     '#ef4444',
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6',
  '#a78bfa', '#fb923c',
]

function kpi(label: string, value: string, sub?: string) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NemAncillaryServicesAnalytics() {
  const [data, setData] = useState<NASRDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNemAncillaryServicesRegulationDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="p-8 text-red-400">
        Failed to load NASR data: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-gray-400 animate-pulse">
        Loading NEM Ancillary Services Regulation Analytics…
      </div>
    )
  }

  const { services, providers, costs, activations, tenders, summary } = data

  // -------------------------------------------------------------------------
  // Chart 1: service annual_cost_m_aud coloured by service_type
  // -------------------------------------------------------------------------
  const servicesCostData = [...services]
    .sort((a, b) => b.annual_cost_m_aud - a.annual_cost_m_aud)
    .map(s => ({
      name: s.service_name.length > 20 ? s.service_name.slice(0, 20) + '…' : s.service_name,
      annual_cost_m_aud: s.annual_cost_m_aud,
      service_type: s.service_type,
    }))

  // -------------------------------------------------------------------------
  // Chart 2: top 15 provider annual_revenue_m_aud coloured by provider_type
  // -------------------------------------------------------------------------
  const topProviders = [...providers]
    .sort((a, b) => b.annual_revenue_m_aud - a.annual_revenue_m_aud)
    .slice(0, 15)
    .map(p => ({
      name: p.provider_name.length > 18 ? p.provider_name.slice(0, 18) + '…' : p.provider_name,
      annual_revenue_m_aud: p.annual_revenue_m_aud,
      provider_type: p.provider_type,
    }))

  // -------------------------------------------------------------------------
  // Chart 3: stacked bar — quarterly cost breakdown (contracted/activation)
  // by service_type (aggregated over all quarters)
  // -------------------------------------------------------------------------
  const serviceTypeQuarterMap: Record<string, { contracted: number; activation: number }> = {}
  for (const c of costs) {
    if (!serviceTypeQuarterMap[c.service_type]) {
      serviceTypeQuarterMap[c.service_type] = { contracted: 0, activation: 0 }
    }
    serviceTypeQuarterMap[c.service_type].contracted += c.contracted_cost_m_aud
    serviceTypeQuarterMap[c.service_type].activation += c.activation_cost_m_aud
  }
  const stackedCostData = Object.entries(serviceTypeQuarterMap).map(([stype, vals]) => ({
    service_type: stype,
    contracted: Math.round(vals.contracted * 100) / 100,
    activation: Math.round(vals.activation * 100) / 100,
  }))

  // -------------------------------------------------------------------------
  // Chart 4: activation capacity_dispatched_mw coloured by outcome
  // -------------------------------------------------------------------------
  const activationData = activations.map((a, idx) => ({
    name: `${a.service_name.slice(0, 12)} ${a.year}`,
    capacity_dispatched_mw: a.capacity_dispatched_mw,
    outcome: a.outcome,
    idx,
  }))

  // -------------------------------------------------------------------------
  // Chart 5: tender winning_price vs reserve_price by service_name
  // -------------------------------------------------------------------------
  const tenderGroupMap: Record<string, { winning: number; reserve: number; count: number }> = {}
  for (const t of tenders) {
    if (!tenderGroupMap[t.service_name]) {
      tenderGroupMap[t.service_name] = { winning: 0, reserve: 0, count: 0 }
    }
    tenderGroupMap[t.service_name].winning += t.winning_price_m_aud
    tenderGroupMap[t.service_name].reserve += t.reserve_price_m_aud
    tenderGroupMap[t.service_name].count += 1
  }
  const tenderAvgData = Object.entries(tenderGroupMap).map(([sname, vals]) => ({
    name: sname,
    winning_price_m_aud: Math.round((vals.winning / vals.count) * 100) / 100,
    reserve_price_m_aud: Math.round((vals.reserve / vals.count) * 100) / 100,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-blue-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            NEM Ancillary Services Regulation Analytics
          </h1>
          <p className="text-sm text-gray-400">
            NSCAS · RERT · SRAS — contracted capacity, costs, activations &amp; tenders
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpi('Total Services', String(summary.total_services))}
        {kpi('Total Contracted MW', `${summary.total_contracted_capacity_mw.toFixed(0)} MW`)}
        {kpi('Total Annual Cost', `$${summary.total_annual_cost_m_aud.toFixed(1)}M`)}
        {kpi('Avg Compliance', `${summary.avg_compliance_pct.toFixed(1)}%`, 'Provider response')}
      </div>

      {/* Chart 1: Service Annual Cost by Service Type */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Service Annual Cost ($M AUD) by Service Type
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={servicesCostData} margin={{ top: 4, right: 16, left: 16, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="annual_cost_m_aud" name="Annual Cost ($M)" radius={[3, 3, 0, 0]}>
              {servicesCostData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={SERVICE_TYPE_COLORS[entry.service_type] ?? PALETTE[idx % PALETTE.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(SERVICE_TYPE_COLORS).map(([stype, color]) => (
            <span key={stype} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              {stype}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Top 15 Provider Annual Revenue by Provider Type */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Top 15 Provider Annual Revenue ($M AUD) by Provider Type
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={topProviders} margin={{ top: 4, right: 16, left: 16, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="annual_revenue_m_aud" name="Annual Revenue ($M)" radius={[3, 3, 0, 0]}>
              {topProviders.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={PROVIDER_TYPE_COLORS[entry.provider_type] ?? PALETTE[idx % PALETTE.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(PROVIDER_TYPE_COLORS).map(([ptype, color]) => (
            <span key={ptype} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              {ptype}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 3: Stacked Bar — Quarterly Cost Breakdown by Service Type */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Quarterly Cost Breakdown (Contracted vs Activation) by Service Type
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stackedCostData} margin={{ top: 4, right: 16, left: 16, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="service_type" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="contracted" name="Contracted Cost ($M)" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="activation" name="Activation Cost ($M)" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Activation Capacity Dispatched by Outcome */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Activation Capacity Dispatched (MW) by Outcome
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={activationData} margin={{ top: 4, right: 16, left: 16, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="capacity_dispatched_mw" name="Capacity Dispatched (MW)" radius={[3, 3, 0, 0]}>
              {activationData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={OUTCOME_COLORS[entry.outcome] ?? PALETTE[idx % PALETTE.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(OUTCOME_COLORS).map(([outcome, color]) => (
            <span key={outcome} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              {outcome}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 5: Tender Winning vs Reserve Price by Service Name */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Tender Avg Winning vs Reserve Price ($M AUD) by Service
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={tenderAvgData} margin={{ top: 4, right: 16, left: 16, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="winning_price_m_aud" name="Avg Winning Price ($M)" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="reserve_price_m_aud" name="Avg Reserve Price ($M)" fill="#6b7280" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary footer */}
      <div className="bg-gray-800 rounded-lg p-4 mt-2">
        <p className="text-sm text-gray-400">
          Most Expensive Service: <span className="text-white font-semibold">{summary.most_expensive_service}</span>
          &nbsp;&bull;&nbsp;
          Total Providers: <span className="text-white font-semibold">{summary.total_providers}</span>
          &nbsp;&bull;&nbsp;
          Activations (2024): <span className="text-white font-semibold">{summary.total_activations_2024}</span>
        </p>
      </div>
    </div>
  )
}
