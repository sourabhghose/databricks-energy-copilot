import { useEffect, useState, useMemo } from 'react'
import { Wind, AlertTriangle, TrendingDown, Zap } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ComposedChart, Area,
} from 'recharts'
import {
  getMerchantRenewableDashboard,
  MWSDashboard,
  MWSProjectRecord,
  MWSRiskRecord,
} from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────────────────

const irrColor = (irr: number) => {
  if (irr > 12) return 'text-green-400'
  if (irr >= 8) return 'text-yellow-400'
  return 'text-red-400'
}

const techBadge = (tech: string) => {
  const map: Record<string, string> = {
    WIND: 'bg-blue-700 text-blue-200',
    SOLAR: 'bg-yellow-700 text-yellow-200',
    WIND_SOLAR_HYBRID: 'bg-purple-700 text-purple-200',
  }
  return map[tech] ?? 'bg-gray-700 text-gray-200'
}

const residualBadge = (risk: string) => {
  if (risk === 'HIGH') return 'bg-red-800 text-red-200'
  if (risk === 'MEDIUM') return 'bg-yellow-800 text-yellow-200'
  return 'bg-green-800 text-green-200'
}

const riskTypeBadge = (type: string) => {
  const map: Record<string, string> = {
    PRICE: 'bg-red-700 text-red-200',
    VOLUME: 'bg-orange-700 text-orange-200',
    BASIS: 'bg-purple-700 text-purple-200',
    REGULATORY: 'bg-blue-700 text-blue-200',
    FINANCING: 'bg-teal-700 text-teal-200',
  }
  return map[type] ?? 'bg-gray-700 text-gray-200'
}

const severityColor = (sev: string) => {
  if (sev === 'SEVERE') return '#ef4444'
  if (sev === 'HIGH') return '#f97316'
  if (sev === 'MODERATE') return '#eab308'
  return '#22c55e'
}

const regionColors: Record<string, string> = {
  NSW1: '#60a5fa',
  QLD1: '#f97316',
  VIC1: '#a78bfa',
  SA1: '#34d399',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{title}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function ProjectTable({ projects }: { projects: MWSProjectRecord[] }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-white font-semibold">Project Economics</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-750 border-b border-gray-700">
              {['Project Name', 'Developer', 'Region', 'Technology', 'Capacity (MW)',
                'PPA % / Merchant %', 'Capture Price ($/MWh)', 'LCOE ($/MWh)',
                'Merchant IRR %', 'Contracted IRR %', 'IRR Delta'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.project_id} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="px-3 py-2 text-white font-medium whitespace-nowrap">{p.project_name}</td>
                <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{p.developer}</td>
                <td className="px-3 py-2">
                  <span className="bg-gray-700 text-gray-200 px-2 py-0.5 rounded text-xs">{p.region}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`${techBadge(p.technology)} px-2 py-0.5 rounded text-xs font-medium`}>
                    {p.technology.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-300 text-right">{p.capacity_mw.toLocaleString()}</td>
                <td className="px-3 py-2 text-center text-gray-300">
                  <span className="text-blue-400">{p.ppa_pct}%</span>
                  <span className="text-gray-500 mx-1">/</span>
                  <span className="text-orange-400">{p.merchant_pct}%</span>
                </td>
                <td className="px-3 py-2 text-right text-gray-300">${p.weighted_avg_capture_price.toFixed(0)}</td>
                <td className="px-3 py-2 text-right text-gray-300">${p.lcoe_per_mwh.toFixed(0)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${irrColor(p.merchant_irr_pct)}`}>
                  {p.merchant_irr_pct.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right text-green-400">{p.fully_contracted_irr_pct.toFixed(1)}%</td>
                <td className="px-3 py-2 text-right text-red-400 font-semibold">
                  {p.irr_delta_vs_contracted.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CapturePriceChart({ data }: { data: MWSDashboard['capture_prices'] }) {
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1']
  const techs = ['WIND', 'SOLAR']
  const years = [2023, 2024, 2025]

  const [selectedRegion, setSelectedRegion] = useState('NSW1')
  const [selectedTech, setSelectedTech] = useState('WIND')
  const [selectedYear, setSelectedYear] = useState(2024)

  const filtered = useMemo(() =>
    data.filter(d => d.region === selectedRegion && d.technology === selectedTech && d.year === selectedYear),
    [data, selectedRegion, selectedTech, selectedYear]
  )

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-white font-semibold">Capture Price vs Spot Price</h2>
        <div className="flex gap-2 flex-wrap">
          <select
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
            className="bg-gray-700 text-gray-200 text-sm rounded px-2 py-1 border border-gray-600"
          >
            {regions.map(r => <option key={r}>{r}</option>)}
          </select>
          <select
            value={selectedTech}
            onChange={e => setSelectedTech(e.target.value)}
            className="bg-gray-700 text-gray-200 text-sm rounded px-2 py-1 border border-gray-600"
          >
            {techs.map(t => <option key={t}>{t}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-gray-700 text-gray-200 text-sm rounded px-2 py-1 border border-gray-600"
          >
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={filtered} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 120]} label={{ value: 'Capture %', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
          <Bar yAxisId="right" dataKey="capture_ratio_pct" name="Capture Ratio %" fill="#6b7280" opacity={0.4} />
          <Line yAxisId="left" type="monotone" dataKey="spot_price_avg" name="Spot Price Avg" stroke="#60a5fa" strokeDasharray="5 5" strokeWidth={2} dot={false} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="capture_price"
            name="Capture Price"
            stroke={selectedTech === 'WIND' ? '#22c55e' : '#eab308'}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function CannibalChart({ data }: { data: MWSDashboard['cannibalisation'] }) {
  const [selectedTech, setSelectedTech] = useState<'WIND' | 'SOLAR'>('SOLAR')

  const filtered = useMemo(() =>
    data.filter(d => d.technology === selectedTech),
    [data, selectedTech]
  )

  // Group by year, pivot by region
  const chartData = useMemo(() => {
    const years = Array.from(new Set(filtered.map(d => d.year))).sort()
    return years.map(year => {
      const row: Record<string, unknown> = { year }
      filtered.filter(d => d.year === year).forEach(d => {
        row[`${d.region}_price`] = d.capture_price
        row[`${d.region}_cap`] = d.installed_capacity_gw
        row[`${d.region}_sev`] = d.cannibalisation_severity
      })
      return row
    })
  }, [filtered])

  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1']

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Cannibalisation Effect on Capture Price (2023-2030)</h2>
        <div className="flex gap-1">
          {(['WIND', 'SOLAR'] as const).map(t => (
            <button
              key={t}
              onClick={() => setSelectedTech(t)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                selectedTech === t
                  ? t === 'WIND' ? 'bg-blue-700 text-white' : 'bg-yellow-700 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: 'GW', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
            labelStyle={{ color: '#f9fafb' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
          {regions.map(r => (
            <Area
              key={`${r}_cap`}
              yAxisId="right"
              type="monotone"
              dataKey={`${r}_cap`}
              name={`${r} Installed (GW)`}
              fill={regionColors[r]}
              stroke={regionColors[r]}
              fillOpacity={0.07}
              strokeWidth={0}
            />
          ))}
          {regions.map(r => (
            <Line
              key={`${r}_price`}
              yAxisId="left"
              type="monotone"
              dataKey={`${r}_price`}
              name={`${r} Capture Price`}
              stroke={regionColors[r]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-3 text-xs">
        {[
          { label: 'SEVERE', color: '#ef4444' },
          { label: 'HIGH', color: '#f97316' },
          { label: 'MODERATE', color: '#eab308' },
          { label: 'LOW', color: '#22c55e' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-gray-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RiskTable({ risks, projects }: { risks: MWSRiskRecord[]; projects: MWSProjectRecord[] }) {
  const [selectedProject, setSelectedProject] = useState('MW006')

  const filtered = useMemo(() =>
    risks
      .filter(r => r.project_id === selectedProject)
      .sort((a, b) => Math.abs(b.irr_impact_pct) - Math.abs(a.irr_impact_pct)),
    [risks, selectedProject]
  )

  const projectOptions = useMemo(() =>
    Array.from(new Set(risks.map(r => r.project_id))).map(id => {
      const p = projects.find(pr => pr.project_id === id)
      return { id, name: p?.project_name ?? id }
    }),
    [risks, projects]
  )

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-white font-semibold">Merchant Risk Assessment</h2>
        <select
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
          className="bg-gray-700 text-gray-200 text-sm rounded px-2 py-1 border border-gray-600"
        >
          {projectOptions.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {['Risk Type', 'Probability (%)', 'Impact ($/MWh)', 'IRR Impact (%)', 'Mitigation', 'Residual Risk'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                <td className="px-3 py-2">
                  <span className={`${riskTypeBadge(r.risk_type)} px-2 py-0.5 rounded text-xs font-medium`}>
                    {r.risk_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-300 text-right">{r.probability_pct}%</td>
                <td className="px-3 py-2 text-gray-300 text-right">${r.impact_per_mwh}</td>
                <td className="px-3 py-2 text-right text-red-400 font-semibold">{r.irr_impact_pct.toFixed(1)}%</td>
                <td className="px-3 py-2 text-gray-300 max-w-xs">{r.mitigation}</td>
                <td className="px-3 py-2">
                  <span className={`${residualBadge(r.residual_risk)} px-2 py-0.5 rounded text-xs font-medium`}>
                    {r.residual_risk}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MerchantRenewableAnalytics() {
  const [data, setData] = useState<MWSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMerchantRenewableDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="w-6 h-6 mr-2" />
        {error ?? 'No data available'}
      </div>
    )
  }

  const { summary, projects, capture_prices, cannibalisation, risks } = data

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-900 rounded-lg">
          <Wind className="w-7 h-7 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Merchant Wind &amp; Solar Project Economics</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            NEM fully merchant &amp; part-merchant renewable project analysis — capture prices, cannibalisation &amp; risk
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Projects"
          value={String(summary.total_projects as number)}
          sub="Tracked merchant/part-merchant"
          icon={Zap}
          color="text-blue-400"
        />
        <KpiCard
          title="Fully Merchant Projects"
          value={String(summary.fully_merchant_projects as number)}
          sub="100% merchant exposure"
          icon={AlertTriangle}
          color="text-orange-400"
        />
        <KpiCard
          title="Avg Merchant IRR"
          value={`${summary.avg_merchant_irr_pct as number}%`}
          sub="Weighted avg across portfolio"
          icon={TrendingDown}
          color="text-yellow-400"
        />
        <KpiCard
          title="Avg IRR Penalty vs Contracted"
          value={`${summary.avg_irr_penalty_vs_contracted as number}%`}
          sub="Merchant discount to PPA"
          icon={TrendingDown}
          color="text-red-400"
        />
      </div>

      {/* Project Economics Table */}
      <ProjectTable projects={projects} />

      {/* Capture Price Chart + Cannibalisation Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CapturePriceChart data={capture_prices} />
        <CannibalChart data={cannibalisation} />
      </div>

      {/* Risk Assessment */}
      <RiskTable risks={risks} projects={projects} />
    </div>
  )
}
