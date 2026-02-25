import { useEffect, useState } from 'react'
import { Leaf, DollarSign, BarChart2, Users } from 'lucide-react'
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
import { getCarbonVoluntaryExchangeDashboard } from '../api/client'
import type { CVEAdashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const PROJECT_TYPE_COLOURS: Record<string, string> = {
  'Reforestation':    '#10b981',
  'Soil Carbon':      '#f59e0b',
  'Savanna Burning':  '#ef4444',
  'Methane Capture':  '#6366f1',
  'Blue Carbon':      '#06b6d4',
}

const CREDIT_TYPE_COLOURS: Record<string, string> = {
  'ACCUs':        '#10b981',
  'VCUs':         '#3b82f6',
  'GoldStandard': '#f59e0b',
  'Plan Vivo':    '#8b5cf6',
  'CAR':          '#ef4444',
}

const SECTOR_COLOURS: Record<string, string> = {
  'Energy':         '#f59e0b',
  'Mining':         '#78716c',
  'Transport':      '#3b82f6',
  'Finance':        '#10b981',
  'Agriculture':    '#22c55e',
  'Manufacturing':  '#6366f1',
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
export default function CarbonVoluntaryExchangeAnalytics() {
  const [data, setData] = useState<CVEAdashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCarbonVoluntaryExchangeDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading Carbon Voluntary Exchange Analytics...</p>
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

  const { credits, trades, projects, prices, summary } = data

  // ---------------------------------------------------------------------------
  // Chart 1: Stacked Bar — Credits issued by project type per state
  // Group credit records by state, stack by project type
  // ---------------------------------------------------------------------------
  const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT']
  const projectTypes = ['Reforestation', 'Soil Carbon', 'Savanna Burning', 'Methane Capture', 'Blue Carbon']

  const creditsByState = states.map(state => {
    const row: Record<string, string | number> = { state }
    for (const ptype of projectTypes) {
      const total = credits
        .filter(c => c.state === state && c.project_type === ptype)
        .reduce((s, c) => s + c.volume_issued, 0)
      row[ptype] = total
    }
    return row
  })

  // ---------------------------------------------------------------------------
  // Chart 2: Grouped Bar — Trade volume by buyer sector (2023 vs 2024)
  // ---------------------------------------------------------------------------
  const buyerSectors = ['Energy', 'Mining', 'Transport', 'Finance', 'Agriculture', 'Manufacturing']

  const tradeVolumeBySector = buyerSectors.map(sector => {
    const vol2023 = trades
      .filter(t => t.buyer_sector === sector && t.year === 2023)
      .reduce((s, t) => s + t.volume_traded, 0)
    const vol2024 = trades
      .filter(t => t.buyer_sector === sector && t.year === 2024)
      .reduce((s, t) => s + t.volume_traded, 0)
    return { sector, '2023': vol2023, '2024': vol2024 }
  })

  // ---------------------------------------------------------------------------
  // Chart 3: Line — ACCU spot price vs forward price trend (2024, monthly)
  // ---------------------------------------------------------------------------
  const accuPriceTrend = prices
    .filter(p => p.credit_type === 'ACCUs' && p.year === 2024)
    .sort((a, b) => a.month - b.month)
    .map(p => ({
      month: `M${p.month}`,
      'Spot Price': p.spot_price_aud,
      'Forward 12m Price': p.forward_12m_price_aud,
    }))

  // ---------------------------------------------------------------------------
  // Chart 4: Horizontal Bar — Project annual abatement by project (top 12, sorted desc)
  // ---------------------------------------------------------------------------
  const topProjects = [...projects]
    .sort((a, b) => b.annual_abatement_ktco2e - a.annual_abatement_ktco2e)
    .slice(0, 12)
    .map(p => ({
      name: p.project_name.length > 28 ? p.project_name.slice(0, 28) + '…' : p.project_name,
      abatement: p.annual_abatement_ktco2e,
    }))
    .reverse() // reverse so highest appears at top of horizontal bar

  // ---------------------------------------------------------------------------
  // Chart 5: Bar — Trade value by credit type (2024)
  // ---------------------------------------------------------------------------
  const creditTypes = ['ACCUs', 'VCUs', 'GoldStandard', 'Plan Vivo', 'CAR']

  const tradeValueByCreditType = creditTypes.map(ctype => {
    const totalVal = trades
      .filter(t => t.credit_type === ctype && t.year === 2024)
      .reduce((s, t) => s + t.total_value_m_aud, 0)
    return { credit_type: ctype, total_value_m_aud: Math.round(totalVal * 1000) / 1000 }
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-green-700 border-b border-green-800 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-green-900 rounded-lg">
          <Leaf size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Carbon Voluntary Exchange Analytics</h1>
          <p className="text-xs text-green-200">CVEA — Credits, Trades, Projects, Pricing & Market Summary</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total Credits Issued"
            value={summary.total_credits_issued.toLocaleString()}
            sub="All credit types & states"
            icon={Leaf}
            color="bg-green-600"
          />
          <KpiCard
            title="Total Trade Value"
            value={`A$${summary.total_trade_value_m_aud.toFixed(2)}M`}
            sub="2023–2024 cumulative"
            icon={DollarSign}
            color="bg-emerald-600"
          />
          <KpiCard
            title="Avg ACCU Price"
            value={`A$${summary.avg_accu_price_aud.toFixed(2)}`}
            sub="Spot price 2024 avg"
            icon={BarChart2}
            color="bg-teal-600"
          />
          <KpiCard
            title="Most Active Buyer Sector"
            value={summary.most_active_buyer_sector}
            sub="By volume traded"
            icon={Users}
            color="bg-cyan-600"
          />
        </div>

        {/* Chart 1: Credits issued by project type per state (stacked) */}
        <ChartCard title="Credits Issued by Project Type per State (stacked)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={creditsByState} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => v.toLocaleString()}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {projectTypes.map(ptype => (
                <Bar
                  key={ptype}
                  dataKey={ptype}
                  stackId="credits"
                  fill={PROJECT_TYPE_COLOURS[ptype] ?? '#6b7280'}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 2: Trade volume by buyer sector (2023 vs 2024 grouped) */}
        <ChartCard title="Trade Volume by Buyer Sector — 2023 vs 2024 (grouped)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tradeVolumeBySector} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="sector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => v.toLocaleString()}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Bar dataKey="2023" name="2023" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="2024" name="2024" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 3: ACCU spot price vs forward price trend (2024 monthly) */}
        <ChartCard title="ACCU Spot Price vs Forward 12m Price — 2024 Monthly Trend">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={accuPriceTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" A$" domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => `A$${v.toFixed(2)}`}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Spot Price"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Forward 12m Price"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Horizontal Bar — Project annual abatement top 12 sorted */}
        <ChartCard title="Project Annual Abatement — Top 12 Projects (ktCO2e, sorted descending)">
          <ResponsiveContainer width="100%" height={420}>
            <BarChart
              layout="vertical"
              data={topProjects}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                unit=" kt"
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                width={200}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => `${v.toFixed(1)} ktCO2e`}
              />
              <Bar dataKey="abatement" name="Annual Abatement (ktCO2e)" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 5: Bar — Trade value by credit type (2024) */}
        <ChartCard title="Trade Value by Credit Type — 2024 (A$M)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tradeValueByCreditType} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="credit_type" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} unit=" M" />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#e5e7eb' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => `A$${v.toFixed(3)}M`}
              />
              {tradeValueByCreditType.map(entry => (
                <Bar
                  key={entry.credit_type}
                  dataKey="total_value_m_aud"
                  name="Trade Value (A$M)"
                  fill={CREDIT_TYPE_COLOURS[entry.credit_type] ?? '#6b7280'}
                  radius={[4, 4, 0, 0]}
                />
              ))}
              <Bar dataKey="total_value_m_aud" name="Trade Value (A$M)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
