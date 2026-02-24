import { useEffect, useState } from 'react'
import { FileText, DollarSign, TrendingUp, Users, Activity } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { getCorporatePpaDashboard } from '../api/client'
import type { CPPAXDashboard } from '../api/client'

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart section wrapper
// ---------------------------------------------------------------------------

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------

const TECH_COLORS: Record<string, string> = {
  Solar: '#f59e0b',
  Wind: '#3b82f6',
  Hydro: '#06b6d4',
  Mixed: '#a78bfa',
}

const CONTRACT_TYPE_COLORS: Record<string, string> = {
  Physical: '#22c55e',
  'Financial (Synthetic)': '#f97316',
  'Bundled RECs': '#ec4899',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CorporatePpaAnalytics() {
  const [data, setData] = useState<CPPAXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCorporatePpaDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading Corporate PPA Analytics…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-red-400">
        {error ?? 'Unknown error'}
      </div>
    )
  }

  const { contracts, pricing, buyers, risk_records, summary } = data

  // ── Chart 1: Buyer total contracted MWh/yr — top 10, sorted desc ──────────
  const buyerVolumeData = [...buyers]
    .sort((a, b) => b.total_contracted_mwh_yr - a.total_contracted_mwh_yr)
    .slice(0, 10)
    .map((b) => ({
      name: b.buyer_name.split(' ').slice(0, 2).join(' '),
      volume: Math.round(b.total_contracted_mwh_yr / 1000),
    }))

  // ── Chart 2: Avg strike price trend by technology (quarterly 2021-2024) ───
  const pricingMap: Record<string, Record<string, number>> = {}
  for (const rec of pricing) {
    const key = `${rec.year} ${rec.quarter}`
    if (!pricingMap[key]) pricingMap[key] = {}
    pricingMap[key][rec.technology] = rec.avg_strike_price_mwh
  }
  const pricingTrendData = Object.entries(pricingMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, techs]) => ({ label, ...techs }))

  // ── Chart 3: Contracts by technology coloured by contract_type ────────────
  const techTypeMap: Record<string, Record<string, number>> = {}
  for (const c of contracts) {
    if (!techTypeMap[c.technology]) techTypeMap[c.technology] = {}
    techTypeMap[c.technology][c.contract_type] =
      (techTypeMap[c.technology][c.contract_type] ?? 0) + 1
  }
  const contractsByTechData = Object.entries(techTypeMap).map(([tech, types]) => ({
    tech,
    ...types,
  }))

  // ── Chart 4: Overall risk score by buyer (avg, sorted desc, top 15) ───────
  const riskByBuyer: Record<string, { total: number; count: number }> = {}
  for (const r of risk_records) {
    if (!riskByBuyer[r.buyer]) riskByBuyer[r.buyer] = { total: 0, count: 0 }
    riskByBuyer[r.buyer].total += r.overall_risk_score
    riskByBuyer[r.buyer].count += 1
  }
  const riskData = Object.entries(riskByBuyer)
    .map(([buyer, { total, count }]) => ({
      name: buyer.split(' ').slice(0, 2).join(' '),
      avg_risk: Math.round((total / count) * 10) / 10,
    }))
    .sort((a, b) => b.avg_risk - a.avg_risk)
    .slice(0, 15)

  // ── Chart 5: Contracts by buyer_sector (count) ────────────────────────────
  const sectorCount: Record<string, number> = {}
  for (const c of contracts) {
    sectorCount[c.buyer_sector] = (sectorCount[c.buyer_sector] ?? 0) + 1
  }
  const sectorData = Object.entries(sectorCount)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="min-h-full bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <FileText size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Corporate PPA Analytics</h1>
          <p className="text-xs text-gray-400">
            Power Purchase Agreement market intelligence — contracts, pricing &amp; risk
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total Contracts"
          value={summary.total_contracts.toString()}
          sub="Active corporate PPAs"
          icon={FileText}
          color="bg-blue-600"
        />
        <KpiCard
          title="Contracted Volume"
          value={`${summary.total_contracted_volume_twh_yr.toFixed(2)} TWh/yr`}
          sub="Aggregate annual volume"
          icon={Activity}
          color="bg-indigo-600"
        />
        <KpiCard
          title="Avg Strike Price"
          value={`$${summary.avg_strike_price_mwh.toFixed(2)}/MWh`}
          sub="Weighted across all contracts"
          icon={DollarSign}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Largest Buyer"
          value={summary.largest_buyer}
          sub="By contracted volume"
          icon={Users}
          color="bg-amber-600"
        />
      </div>

      {/* Chart 1 — Buyer volume (top 10) */}
      <ChartSection title="Top 10 Buyers by Contracted Volume (GWh/yr)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={buyerVolumeData} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number) => [`${v} GWh/yr`, 'Volume']}
            />
            <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 2 — Strike price trend by technology */}
      <ChartSection title="Avg Strike Price Trend by Technology ($/MWh, 2021–2024)">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={pricingTrendData} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={3}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
            {Object.keys(TECH_COLORS).map((tech) => (
              <Line
                key={tech}
                type="monotone"
                dataKey={tech}
                stroke={TECH_COLORS[tech]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 3 — Contracts by technology and contract_type */}
      <ChartSection title="Contracts by Technology and Contract Type">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={contractsByTechData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="tech" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {Object.keys(CONTRACT_TYPE_COLORS).map((ct) => (
              <Bar
                key={ct}
                dataKey={ct}
                stackId="a"
                fill={CONTRACT_TYPE_COLORS[ct]}
                radius={ct === 'Bundled RECs' ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 4 — Avg risk score by buyer (top 15) */}
      <ChartSection title="Average Overall Risk Score by Buyer (top 15, 1–10 scale)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={riskData} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 10]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number) => [v.toFixed(1), 'Avg Risk Score']}
            />
            <Bar dataKey="avg_risk" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Chart 5 — Contracts by buyer sector */}
      <ChartSection title="Contracts by Buyer Sector">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={sectorData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f9fafb' }}
              formatter={(v: number) => [v, 'Contracts']}
            />
            <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]}>
              {sectorData.map((_entry, index) => (
                <rect key={`cell-${index}`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Trend indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <TrendingUp size={14} />
        <span>Data generated with seed 15401 — refreshes are deterministic</span>
      </div>
    </div>
  )
}
