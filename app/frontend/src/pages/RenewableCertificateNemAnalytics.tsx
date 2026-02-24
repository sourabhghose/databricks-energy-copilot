import { useEffect, useState } from 'react'
import { Award, DollarSign, Activity, CheckCircle } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import { getRenewableCertificateNemDashboard } from '../api/client'
import type { RCNAdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const STATE_COLOURS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#6366f1',
  QLD: '#f59e0b',
  SA:  '#10b981',
  WA:  '#ef4444',
  TAS: '#8b5cf6',
}

const TECH_COLOURS: Record<string, string> = {
  Solar:      '#f59e0b',
  Wind:       '#3b82f6',
  Hydro:      '#06b6d4',
  Biomass:    '#22c55e',
  Geothermal: '#ef4444',
}

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
// Chart Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function RenewableCertificateNemAnalytics() {
  const [data, setData] = useState<RCNAdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRenewableCertificateNemDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading REC NEM Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  const { lgc_records, stc_records, generators, compliance, summary } = data

  const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS']
  const quarters2024 = ['Q1', 'Q2', 'Q3', 'Q4']

  // Chart 1: LGC spot price trend by state (quarterly 2024)
  const lgcPriceTrend = quarters2024.map(qtr => {
    const row: Record<string, string | number> = { quarter: qtr }
    for (const state of states) {
      const rec = lgc_records.find(r => r.year === 2024 && r.quarter === qtr && r.state === state)
      row[state] = rec ? rec.lgc_spot_price_aud : 0
    }
    return row
  })

  // Chart 2: LGC created vs surrendered by state (2024 total across all quarters)
  const lgcCreatedVsSurrendered = states.map(state => {
    const recs = lgc_records.filter(r => r.year === 2024 && r.state === state)
    return {
      state,
      lgc_created: recs.reduce((s, r) => s + r.lgc_created, 0),
      lgc_surrendered: recs.reduce((s, r) => s + r.lgc_surrendered, 0),
    }
  })

  // Chart 3: STC price trend by quarter (2024, averaged across states)
  const stcPriceTrend = quarters2024.map(qtr => {
    const recs = stc_records.filter(r => r.year === 2024 && r.quarter === qtr)
    const avg = recs.length > 0
      ? Math.round((recs.reduce((s, r) => s + r.stc_price_aud, 0) / recs.length) * 100) / 100
      : 0
    return { quarter: qtr, avg_stc_price_aud: avg }
  })

  // Chart 4: Generator capacity MW by technology (sorted desc)
  const techCapacity: Record<string, number> = {}
  for (const g of generators) {
    techCapacity[g.technology] = (techCapacity[g.technology] ?? 0) + g.capacity_mw
  }
  const genCapacityByTech = Object.entries(techCapacity)
    .map(([technology, capacity_mw]) => ({ technology, capacity_mw: Math.round(capacity_mw * 10) / 10 }))
    .sort((a, b) => b.capacity_mw - a.capacity_mw)

  // Chart 5: Compliance rate % by entity type (2024 averaged)
  const entityTypes = ['Retailer', 'Large User', 'Exempt']
  const complianceByType = entityTypes.map(et => {
    const recs = compliance.filter(r => r.year === 2024 && r.entity_type === et)
    const avg = recs.length > 0
      ? Math.round((recs.reduce((s, r) => s + r.compliance_pct, 0) / recs.length) * 100) / 100
      : 0
    return { entity_type: et, avg_compliance_pct: avg }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-green-600 border-b border-green-700 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-green-800 rounded-lg">
          <Award size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">REC NEM Analytics</h1>
          <p className="text-xs text-green-200">Renewable Energy Certificate NEM Analytics — LGC, STC & Compliance</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total Accredited Generators"
            value={String(summary.total_accredited_generators)}
            sub="All technologies"
            icon={Award}
            color="bg-green-600"
          />
          <KpiCard
            title="Total LGCs Created 2024"
            value={summary.total_lgc_created_2024.toLocaleString()}
            sub="Thousands"
            icon={Activity}
            color="bg-blue-600"
          />
          <KpiCard
            title="Avg LGC Price 2024"
            value={`$${summary.avg_lgc_price_2024.toFixed(2)}`}
            sub="Spot price AUD"
            icon={DollarSign}
            color="bg-yellow-600"
          />
          <KpiCard
            title="Overall Compliance Rate"
            value={`${summary.overall_compliance_rate_pct.toFixed(1)}%`}
            sub="2024 average"
            icon={CheckCircle}
            color="bg-emerald-600"
          />
        </div>

        {/* Chart 1: LGC spot price trend by state (line, quarterly 2024) */}
        <ChartCard title="LGC Spot Price Trend by State — Quarterly 2024 (AUD)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lgcPriceTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="$" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {states.map(state => (
                <Line
                  key={state}
                  type="monotone"
                  dataKey={state}
                  stroke={STATE_COLOURS[state]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: LGC created vs surrendered by state (grouped bar, 2024 total) */}
        <ChartCard title="LGC Created vs Surrendered by State — 2024 Total (thousands)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={lgcCreatedVsSurrendered} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="lgc_created" name="LGC Created" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lgc_surrendered" name="LGC Surrendered" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: STC price trend by quarter (2024, averaged across states) */}
        <ChartCard title="Avg STC Price by Quarter — 2024 (AUD, averaged across states)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stcPriceTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="$" domain={[0, 45]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="avg_stc_price_aud" name="Avg STC Price (AUD)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Generator capacity MW by technology (horizontal bar, sorted desc) */}
        <ChartCard title="Generator Capacity MW by Technology (sorted descending)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={genCapacityByTech}
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" MW" />
              <YAxis type="category" dataKey="technology" tick={{ fill: '#9ca3af', fontSize: 12 }} width={80} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="capacity_mw" name="Capacity (MW)" radius={[0, 4, 4, 0]}>
                {genCapacityByTech.map(entry => (
                  <rect key={entry.technology} fill={TECH_COLOURS[entry.technology] ?? '#6b7280'} />
                ))}
                {genCapacityByTech.map(entry => (
                  <Bar
                    key={entry.technology}
                    dataKey="capacity_mw"
                    fill={TECH_COLOURS[entry.technology] ?? '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Compliance rate % by entity type (2024 averaged) */}
        <ChartCard title="Avg Compliance Rate % by Entity Type — 2024">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={complianceByType} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="entity_type" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="avg_compliance_pct" name="Avg Compliance %" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
