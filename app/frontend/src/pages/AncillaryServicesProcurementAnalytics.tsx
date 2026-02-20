import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Radio, DollarSign, Zap, TrendingUp, Activity } from 'lucide-react'
import {
  getAncillaryServicesProcurementDashboard,
  ASPDashboard,
  ASPProviderRecord,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const SERVICE_COLOURS: Record<string, string> = {
  RAISE_6SEC:  '#f472b6',
  LOWER_6SEC:  '#fb923c',
  RAISE_60SEC: '#facc15',
  LOWER_60SEC: '#4ade80',
  RAISE_5MIN:  '#60a5fa',
  LOWER_5MIN:  '#2dd4bf',
  RAISE_REG:   '#a78bfa',
  LOWER_REG:   '#f87171',
}

const TECH_COLOURS: Record<string, string> = {
  battery_share_pct:         '#60a5fa',
  hydro_share_pct:           '#2dd4bf',
  gas_share_pct:             '#fb923c',
  demand_response_pct:       '#4ade80',
}

const COST_COLOURS: Record<string, string> = {
  raise_cost_aud_m:       '#60a5fa',
  lower_cost_aud_m:       '#4ade80',
  regulation_cost_aud_m:  '#f472b6',
}

const PROVIDER_TYPE_COLOURS: Record<string, string> = {
  BESS:             'bg-blue-700',
  HYDRO:            'bg-cyan-700',
  GAS_PEAKER:       'bg-orange-700',
  DEMAND_RESPONSE:  'bg-green-700',
  PUMPED_HYDRO:     'bg-purple-700',
}

const PRICE_LINE_COLOURS: Record<string, string> = {
  RAISE_REG:  '#a78bfa',
  RAISE_6SEC: '#f472b6',
  RAISE_5MIN: '#60a5fa',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon }: {
  label: string; value: string; sub?: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
      <div className="p-3 bg-gray-700 rounded-lg">
        <Icon className="w-6 h-6 text-cyan-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, colourClass }: { label: string; colourClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold text-white ${colourClass}`}>
      {label}
    </span>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">
      {title}
    </h2>
  )
}

// ─── Chart data builders ──────────────────────────────────────────────────────
function buildServiceEnablementData(data: ASPDashboard) {
  const serviceNames = ["RAISE_6SEC", "LOWER_6SEC", "RAISE_60SEC", "LOWER_60SEC",
                        "RAISE_5MIN", "LOWER_5MIN", "RAISE_REG", "LOWER_REG"]
  return serviceNames.map(svc => {
    const records = data.services.filter(s => s.service === svc)
    const avgReq = records.length > 0
      ? records.reduce((sum, r) => sum + r.requirement_mw, 0) / records.length
      : 0
    const avgEnabled = records.length > 0
      ? records.reduce((sum, r) => sum + r.enabled_mw, 0) / records.length
      : 0
    return {
      name: svc.replace('_', ' '),
      requirement: Math.round(avgReq),
      enabled: Math.round(avgEnabled),
    }
  })
}

function buildTechMixData(data: ASPDashboard) {
  const serviceNames = ["RAISE_6SEC", "LOWER_6SEC", "RAISE_60SEC", "LOWER_60SEC",
                        "RAISE_5MIN", "LOWER_5MIN", "RAISE_REG", "LOWER_REG"]
  return serviceNames.map(svc => {
    const records = data.enablements.filter(e => e.service === svc)
    const avg = (key: keyof typeof records[0]) =>
      records.length > 0
        ? Math.round(records.reduce((sum, r) => sum + (r[key] as number), 0) / records.length * 10) / 10
        : 0
    return {
      name: svc.replace('_', ' '),
      battery_share_pct:        avg('battery_share_pct'),
      hydro_share_pct:          avg('hydro_share_pct'),
      gas_share_pct:            avg('gas_share_pct'),
      demand_response_pct:      avg('demand_response_pct'),
    }
  })
}

function buildPriceTrendData(data: ASPDashboard) {
  const quarters = ["Q1 2023", "Q2 2023", "Q3 2023", "Q4 2023",
                    "Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"]
  const targetServices = ["RAISE_REG", "RAISE_6SEC", "RAISE_5MIN"]
  return quarters.map(q => {
    const row: Record<string, string | number> = { quarter: q }
    for (const svc of targetServices) {
      const records = data.prices.filter(p => p.service === svc && p.quarter === q)
      row[svc] = records.length > 0
        ? Math.round(records.reduce((sum, r) => sum + r.avg_price_aud_mwh, 0) / records.length * 100) / 100
        : 0
    }
    return row
  })
}

function buildCostAllocationData(data: ASPDashboard) {
  const regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
  return regions.map(region => {
    const records = data.cost_allocations.filter(c => c.region === region)
    const avg = (key: keyof typeof records[0]) =>
      records.length > 0
        ? Math.round(records.reduce((sum, r) => sum + (r[key] as number), 0) / records.length * 100) / 100
        : 0
    return {
      region,
      raise_cost_aud_m:       avg('raise_cost_aud_m'),
      lower_cost_aud_m:       avg('lower_cost_aud_m'),
      regulation_cost_aud_m:  avg('regulation_cost_aud_m'),
    }
  })
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AncillaryServicesProcurementAnalytics() {
  const [data, setData] = useState<ASPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAncillaryServicesProcurementDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading ancillary services procurement data...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400">Error: {error ?? 'No data'}</p>
      </div>
    )
  }

  const summary = data.summary as Record<string, unknown>

  const serviceEnablementData = buildServiceEnablementData(data)
  const techMixData = buildTechMixData(data)
  const priceTrendData = buildPriceTrendData(data)
  const costAllocationData = buildCostAllocationData(data)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-800 rounded-lg">
          <Radio className="w-7 h-7 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Ancillary Services Procurement Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            NEM FCAS enablement trends, regulation raise/lower analytics and cost allocation
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Service Types"
          value={String(summary['total_service_types'] ?? 8)}
          sub="FCAS raise & lower services"
          Icon={Activity}
        />
        <KpiCard
          label="Total AS Market Revenue"
          value={`$${summary['total_as_market_revenue_aud_m'] ?? '—'}M`}
          sub="AUD annual market revenue"
          Icon={DollarSign}
        />
        <KpiCard
          label="Battery Share Trend"
          value={`${summary['battery_share_pct_trend'] ?? '—'}%`}
          sub="BESS enablement share (growing)"
          Icon={Zap}
        />
        <KpiCard
          label="Highest Price Service"
          value={String(summary['highest_price_service'] ?? 'RAISE_REG')}
          sub={`Avg $${summary['raise_regulation_avg_price_aud_mwh'] ?? '—'}/MWh`}
          Icon={TrendingUp}
        />
      </div>

      {/* ── Service Enablement vs Requirement ── */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <SectionHeader title="Service Enablement vs Requirement (MW, avg across regions)" />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={serviceEnablementData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="requirement" name="Requirement MW" fill="#6b7280" radius={[3, 3, 0, 0]} />
            <Bar dataKey="enabled" name="Enabled MW" fill="#60a5fa" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Technology Mix ── */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <SectionHeader title="Technology Mix by Service Type (% share, avg)" />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={techMixData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="battery_share_pct"       name="Battery (BESS)"        stackId="a" fill={TECH_COLOURS['battery_share_pct']} />
            <Bar dataKey="hydro_share_pct"          name="Hydro"                  stackId="a" fill={TECH_COLOURS['hydro_share_pct']} />
            <Bar dataKey="gas_share_pct"            name="Gas Peaker"             stackId="a" fill={TECH_COLOURS['gas_share_pct']} />
            <Bar dataKey="demand_response_pct"      name="Demand Response"        stackId="a" fill={TECH_COLOURS['demand_response_pct']} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Price Trends ── */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <SectionHeader title="FCAS Price Trends — Raise Regulation, Raise 6sec, Raise 5min (AUD/MWh, avg)" />
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/MWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.entries(PRICE_LINE_COLOURS).map(([svc, colour]) => (
              <Line
                key={svc}
                type="monotone"
                dataKey={svc}
                name={svc.replace('_', ' ')}
                stroke={colour}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Provider Table ── */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <SectionHeader title="FCAS Provider Registry" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-700">
                <th className="pb-3 pr-4">Provider</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Region</th>
                <th className="pb-3 pr-4">Service</th>
                <th className="pb-3 pr-4 text-right">Enabled MW</th>
                <th className="pb-3 pr-4 text-right">Market Share</th>
                <th className="pb-3 pr-4 text-right">Avg Price $/MWh</th>
                <th className="pb-3 text-right">Compliance %</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((p: ASPProviderRecord, i: number) => (
                <tr
                  key={i}
                  className="border-b border-gray-700 hover:bg-gray-700 transition-colors"
                >
                  <td className="py-3 pr-4 text-white font-medium">{p.provider}</td>
                  <td className="py-3 pr-4">
                    <Badge
                      label={p.provider_type}
                      colourClass={PROVIDER_TYPE_COLOURS[p.provider_type] ?? 'bg-gray-600'}
                    />
                  </td>
                  <td className="py-3 pr-4 text-gray-300">{p.region}</td>
                  <td className="py-3 pr-4">
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: (SERVICE_COLOURS[p.service] ?? '#6b7280') + '33',
                        color: SERVICE_COLOURS[p.service] ?? '#9ca3af',
                      }}
                    >
                      {p.service.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-gray-300">{p.enabled_mw.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right text-gray-300">{p.market_share_pct.toFixed(1)}%</td>
                  <td className="py-3 pr-4 text-right text-gray-300">${p.avg_price_aud_mwh.toFixed(2)}</td>
                  <td className="py-3 text-right">
                    <span className={`font-semibold ${p.compliance_pct >= 98 ? 'text-green-400' : p.compliance_pct >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {p.compliance_pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cost Allocation ── */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <SectionHeader title="AS Cost Allocation by Region (AUD M, avg quarterly)" />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={costAllocationData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="raise_cost_aud_m"      name="Raise Cost ($M)"       stackId="a" fill={COST_COLOURS['raise_cost_aud_m']} />
            <Bar dataKey="lower_cost_aud_m"      name="Lower Cost ($M)"       stackId="a" fill={COST_COLOURS['lower_cost_aud_m']} />
            <Bar dataKey="regulation_cost_aud_m" name="Regulation Cost ($M)"  stackId="a" fill={COST_COLOURS['regulation_cost_aud_m']} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
