import { useEffect, useState } from 'react'
import { Leaf } from 'lucide-react'
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
  getAustralianCarbonCreditDashboard,
  ACCUDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  'Land':               '#10b981',
  'Vegetation':         '#34d399',
  'Agriculture':        '#f59e0b',
  'Industrial':         '#6366f1',
  'Waste':              '#8b5cf6',
  'Energy Efficiency':  '#06b6d4',
}

const COMPLIANCE_COLORS: Record<string, string> = {
  'Compliant':     '#10b981',
  'Shortfall':     '#ef4444',
  'Over-achieved': '#3b82f6',
}

const DEMAND_COLORS: Record<string, string> = {
  safeguard_demand_kt:    '#ef4444',
  voluntary_demand_kt:    '#f59e0b',
  government_contracts_kt:'#3b82f6',
}

const CO_BENEFIT_COLORS: Record<string, string> = {
  'Biodiversity':          '#10b981',
  'Employment':            '#3b82f6',
  'Indigenous':            '#f59e0b',
  'Water':                 '#06b6d4',
  'Biodiversity/Employment': '#8b5cf6',
  'Indigenous/Water':      '#f97316',
  'Biodiversity/Water':    '#14b8a6',
}

const PALETTE = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6','#a78bfa','#fb923c']

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

export default function AustralianCarbonCreditAnalytics() {
  const [data, setData] = useState<ACCUDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAustralianCarbonCreditDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="p-8 text-red-400">
        Failed to load ACCU data: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-gray-400 animate-pulse">
        Loading Australian Carbon Credit Unit Analytics...
      </div>
    )
  }

  const { methodologies, market_prices, projects, safeguard, demand_supply, summary } = data

  // -------------------------------------------------------------------------
  // Chart 1: methodology issuances_2024_kt coloured by category
  // -------------------------------------------------------------------------
  const methodologyData = methodologies.map(m => ({
    name: m.method_name.length > 22 ? m.method_name.slice(0, 22) + '...' : m.method_name,
    issuances_2024_kt: m.issuances_2024_kt,
    category: m.category,
  }))

  // -------------------------------------------------------------------------
  // Chart 2: spot_price_aud monthly trend 2020-2024
  // -------------------------------------------------------------------------
  const priceData = market_prices.map(p => ({
    period: `${p.year}-${String(p.month).padStart(2, '0')}`,
    spot_price_aud: p.spot_price_aud,
    forward_2yr_price_aud: p.forward_2yr_price_aud,
    voluntary_market_price_aud: p.voluntary_market_price_aud,
  }))

  // -------------------------------------------------------------------------
  // Chart 3: safeguard entity accu_surrender_kt coloured by compliance_status
  // -------------------------------------------------------------------------
  const safeguardData = safeguard.map(s => ({
    name: s.entity_name.length > 20 ? s.entity_name.slice(0, 20) + '...' : s.entity_name,
    accu_surrender_kt: s.accu_surrender_kt,
    compliance_status: s.compliance_status,
  }))

  // -------------------------------------------------------------------------
  // Chart 4: quarterly demand/supply breakdown (stacked bar)
  // -------------------------------------------------------------------------
  const demandSupplyData = demand_supply.map(d => ({
    period: `${d.year} ${d.quarter}`,
    safeguard_demand_kt: d.safeguard_demand_kt,
    voluntary_demand_kt: d.voluntary_demand_kt,
    government_contracts_kt: d.government_contracts_kt,
  }))

  // -------------------------------------------------------------------------
  // Chart 5: project total_issuances_kt by proponent coloured by co_benefits (top 15)
  // -------------------------------------------------------------------------
  const proponentMap: Record<string, { total_issuances_kt: number; co_benefits: string }> = {}
  for (const proj of projects) {
    if (!proponentMap[proj.proponent]) {
      proponentMap[proj.proponent] = { total_issuances_kt: 0, co_benefits: proj.co_benefits }
    }
    proponentMap[proj.proponent].total_issuances_kt += proj.total_issuances_kt
  }
  const topProponents = Object.entries(proponentMap)
    .sort((a, b) => b[1].total_issuances_kt - a[1].total_issuances_kt)
    .slice(0, 15)
    .map(([name, vals]) => ({
      name: name.length > 20 ? name.slice(0, 20) + '...' : name,
      total_issuances_kt: Math.round(vals.total_issuances_kt * 10) / 10,
      co_benefits: vals.co_benefits,
    }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Leaf className="text-emerald-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            ACCU — Australian Carbon Credit Unit Market Analytics
          </h1>
          <p className="text-sm text-gray-400">
            Emissions Reduction Fund (ERF) &amp; Safeguard Mechanism — methodology issuances, market prices, project registry
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {kpi('Total Registered Projects', String(summary.total_registered_projects), 'ERF registry')}
        {kpi('Total Issuances 2024', `${summary.total_issuances_2024_kt.toFixed(0)} kt CO₂e`, 'Registry issued')}
        {kpi('Current Spot Price', `$${summary.current_spot_price_aud.toFixed(2)} AUD`, 'Per ACCU')}
        {kpi('Safeguard Entities', String(summary.safeguard_entities_count), 'Covered facilities')}
      </div>

      {/* Chart 1: Methodology Issuances */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Methodology Issuances 2024 (kt CO₂e) by Category
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={methodologyData} margin={{ top: 4, right: 16, left: 16, bottom: 110 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" kt" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="issuances_2024_kt" name="Issuances (kt)" radius={[3, 3, 0, 0]}>
              {methodologyData.map((entry, idx) => (
                <Cell key={idx} fill={CATEGORY_COLORS[entry.category] ?? PALETTE[idx % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Spot Price Monthly Trend */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          ACCU Spot Price Monthly Trend 2020–2024 (AUD/credit)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={priceData} margin={{ top: 4, right: 20, left: 16, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="period"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={5}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="spot_price_aud"
              name="Spot Price (AUD)"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="forward_2yr_price_aud"
              name="2-Year Forward (AUD)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="voluntary_market_price_aud"
              name="Voluntary Market (AUD)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Safeguard Entity ACCU Surrender */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Safeguard Entity ACCU Surrender (kt) by Compliance Status
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={safeguardData} margin={{ top: 4, right: 16, left: 16, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" kt" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="accu_surrender_kt" name="ACCU Surrender (kt)" radius={[3, 3, 0, 0]}>
              {safeguardData.map((entry, idx) => (
                <Cell key={idx} fill={COMPLIANCE_COLORS[entry.compliance_status] ?? PALETTE[idx % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(COMPLIANCE_COLORS).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 4: Quarterly Demand/Supply Breakdown (Stacked Bar) */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Quarterly ACCU Demand Breakdown — Safeguard / Voluntary / Govt Contracts (kt)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={demandSupplyData} margin={{ top: 4, right: 16, left: 16, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="period"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" kt" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="safeguard_demand_kt" name="Safeguard Demand" stackId="demand"
              fill={DEMAND_COLORS['safeguard_demand_kt']} />
            <Bar dataKey="voluntary_demand_kt" name="Voluntary Demand" stackId="demand"
              fill={DEMAND_COLORS['voluntary_demand_kt']} />
            <Bar dataKey="government_contracts_kt" name="Govt Contracts" stackId="demand"
              fill={DEMAND_COLORS['government_contracts_kt']} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Project Issuances by Proponent (top 15) */}
      <div className="bg-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Top 15 Proponents — Total Project Issuances (kt CO₂e) by Co-Benefits
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={topProponents} margin={{ top: 4, right: 16, left: 16, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" kt" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="total_issuances_kt" name="Total Issuances (kt)" radius={[3, 3, 0, 0]}>
              {topProponents.map((entry, idx) => (
                <Cell key={idx} fill={CO_BENEFIT_COLORS[entry.co_benefits] ?? PALETTE[idx % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(CO_BENEFIT_COLORS).map(([benefit, color]) => (
            <span key={benefit} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {benefit}
            </span>
          ))}
        </div>
      </div>

      {/* Footer info */}
      <div className="text-xs text-gray-600 text-center pb-4">
        Data: Australian Carbon Credit Units (ACCU) — ERF / Safeguard Mechanism — Clean Energy Regulator (synthetic demonstration data)
      </div>
    </div>
  )
}
