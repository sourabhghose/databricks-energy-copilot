import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
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
  getEnergyPovertyHardshipXDashboard,
  EPHPXDashboard,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const STATE_COLORS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#10b981',
  QLD: '#f59e0b',
  SA:  '#8b5cf6',
  TAS: '#06b6d4',
  WA:  '#f97316',
}

const PROGRAM_TYPE_COLORS: Record<string, string> = {
  'Retailer Hardship':       '#3b82f6',
  'Government Concession':   '#10b981',
  'Rebate':                  '#f59e0b',
  'Emergency Relief':        '#ef4444',
  'Energy Efficiency Grant': '#8b5cf6',
  'Payment Plan':            '#f97316',
  'Solar Subsidy':           '#06b6d4',
}

const LINE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#f97316']

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  unit,
}: {
  label: string
  value: string | number
  unit?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 border border-gray-700">
      <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-white text-2xl font-bold">
        {value}
        {unit && <span className="text-gray-400 text-sm font-normal ml-1">{unit}</span>}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-white font-semibold text-lg mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EnergyPovertyHardshipXAnalytics() {
  const [data, setData] = useState<EPHPXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEnergyPovertyHardshipXDashboard()
      .then(setData)
      .catch((err) => setError(err.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-400 text-lg">Loading EPHPX dashboard…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-red-400 text-lg">{error ?? 'No data available'}</span>
      </div>
    )
  }

  const { regions, programs, trends, affordability, retailer_compliance, summary } = data

  // -------------------------------------------------------------------------
  // Chart 1 — Region hardship_rate_pct vs avg_arrears coloured by state
  // -------------------------------------------------------------------------
  const regionChartData = regions.map((r) => ({
    name: r.region_name.length > 16 ? r.region_name.slice(0, 14) + '…' : r.region_name,
    hardship_rate_pct: r.hardship_rate_pct,
    avg_arrears_aud: r.avg_arrears_aud,
    state: r.state,
  }))

  // -------------------------------------------------------------------------
  // Chart 2 — Top 15 programs by beneficiaries_k coloured by program_type
  // -------------------------------------------------------------------------
  const top15Programs = [...programs]
    .sort((a, b) => b.beneficiaries_k - a.beneficiaries_k)
    .slice(0, 15)
    .map((p) => ({
      name: p.program_name.length > 22 ? p.program_name.slice(0, 20) + '…' : p.program_name,
      beneficiaries_k: p.beneficiaries_k,
      program_type: p.program_type,
    }))

  // -------------------------------------------------------------------------
  // Chart 3 — Quarterly hardship_customers_k trend for 5 regions
  // -------------------------------------------------------------------------
  const trendRegions = ['R01', 'R02', 'R03', 'R04', 'R05']
  const trendLabels: Record<string, string> = {
    R01: 'Syd',
    R02: 'Melb',
    R03: 'Bris',
    R04: 'Adel',
    R05: 'Hob',
  }

  // Build a map keyed by "year-quarter"
  const trendMap: Record<string, Record<string, number>> = {}
  for (const t of trends) {
    const key = `${t.year}-${t.quarter}`
    if (!trendMap[key]) trendMap[key] = {}
    trendMap[key][t.region_id] = t.hardship_customers_k
  }
  const trendChartData = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => ({ period: key, ...vals }))

  // -------------------------------------------------------------------------
  // Chart 4 — Affordability ratio by income_decile for each state
  // -------------------------------------------------------------------------
  const affDeciles = [...new Set(affordability.map((a) => a.income_decile))].sort((a, b) => a - b)
  const affStates = [...new Set(affordability.map((a) => a.state))].sort()
  const affChartData = affDeciles.map((decile) => {
    const row: Record<string, number | string> = { decile: `D${decile}` }
    for (const st of affStates) {
      const rec = affordability.find((a) => a.income_decile === decile && a.state === st)
      if (rec) row[st] = rec.energy_affordability_ratio_pct
    }
    return row
  })

  // -------------------------------------------------------------------------
  // Chart 5 — Retailer aer_audit_score vs disconnection_before_hardship_pct
  // -------------------------------------------------------------------------
  // Use latest year per retailer
  const latestByRetailer: Record<string, typeof retailer_compliance[0]> = {}
  for (const rc of retailer_compliance) {
    if (!latestByRetailer[rc.retailer_name] || rc.year > latestByRetailer[rc.retailer_name].year) {
      latestByRetailer[rc.retailer_name] = rc
    }
  }
  const retailerChartData = Object.values(latestByRetailer).map((rc) => ({
    name: rc.retailer_name,
    aer_audit_score: rc.aer_audit_score,
    disconnection_before_hardship_pct: rc.disconnection_before_hardship_pct,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Heart className="text-pink-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Energy Poverty &amp; Hardship Program Analytics
          </h1>
          <p className="text-gray-400 text-sm">
            Australian energy hardship indicators, programs, affordability and retailer compliance
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Hardship Customers"
          value={summary.total_hardship_customers_k.toFixed(1)}
          unit="k"
        />
        <KpiCard
          label="Avg Hardship Rate"
          value={summary.avg_hardship_rate_pct.toFixed(2)}
          unit="%"
        />
        <KpiCard
          label="Total Program Cost"
          value={`$${summary.total_program_cost_m_aud.toFixed(1)}`}
          unit="M"
        />
        <KpiCard
          label="Total Beneficiaries"
          value={summary.total_beneficiaries_k.toFixed(1)}
          unit="k"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1 — Region hardship rate vs arrears */}
        <Section title="Regional Hardship Rate vs Avg Arrears by State">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={regionChartData} margin={{ top: 4, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              <Bar dataKey="hardship_rate_pct" name="Hardship Rate %" maxBarSize={32}>
                {regionChartData.map((entry, i) => (
                  <Cell key={i} fill={STATE_COLORS[entry.state] ?? '#6b7280'} />
                ))}
              </Bar>
              <Bar dataKey="avg_arrears_aud" name="Avg Arrears AUD" maxBarSize={32} fill="#f97316" opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Chart 2 — Top 15 programs by beneficiaries */}
        <Section title="Top 15 Programs by Beneficiaries (k)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={top15Programs}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 130, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                width={125}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Bar dataKey="beneficiaries_k" name="Beneficiaries k" maxBarSize={20}>
                {top15Programs.map((entry, i) => (
                  <Cell key={i} fill={PROGRAM_TYPE_COLORS[entry.program_type] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Chart 3 — Quarterly trend for 5 regions */}
        <Section title="Quarterly Hardship Customers Trend 2022–2024 (5 Regions)">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendChartData} margin={{ top: 4, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="period"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                angle={-45}
                textAnchor="end"
                interval={1}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              {trendRegions.map((rid, i) => (
                <Line
                  key={rid}
                  type="monotone"
                  dataKey={rid}
                  name={trendLabels[rid]}
                  stroke={LINE_COLORS[i]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Section>

        {/* Chart 4 — Affordability ratio by income decile per state */}
        <Section title="Energy Affordability Ratio by Income Decile and State (%)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={affChartData} margin={{ top: 4, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="decile" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              {affStates.map((st, i) => (
                <Bar
                  key={st}
                  dataKey={st}
                  name={st}
                  fill={STATE_COLORS[st] ?? LINE_COLORS[i % LINE_COLORS.length]}
                  maxBarSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Chart 5 — Retailer audit score vs disconnection before hardship */}
        <Section title="Retailer AER Audit Score vs Disconnection Before Hardship %">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={retailerChartData}
              margin={{ top: 4, right: 20, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              <Bar dataKey="aer_audit_score" name="AER Audit Score" fill="#10b981" maxBarSize={28} />
              <Bar
                dataKey="disconnection_before_hardship_pct"
                name="Disconnection Before Hardship %"
                fill="#ef4444"
                maxBarSize={28}
                opacity={0.8}
              />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>
    </div>
  )
}
