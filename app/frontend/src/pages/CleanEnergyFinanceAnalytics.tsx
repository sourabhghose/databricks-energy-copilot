import { useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getCleanEnergyFinanceDashboard,
  CEFDashboard,
  CEFInvestmentRecord,
  CEFBlendedFinanceRecord,
} from '../api/client'

const TECH_COLORS: Record<string, string> = {
  'Solar PV':        '#fbbf24',
  'Wind':            '#60a5fa',
  'Battery Storage': '#34d399',
  'Green Hydrogen':  '#a78bfa',
  'Transmission':    '#f87171',
  'Pumped Hydro':    '#38bdf8',
  'Geothermal':      '#fb923c',
  'Offshore Wind':   '#4ade80',
}

const STATUS_COLORS: Record<string, string> = {
  Operating:       'bg-green-600',
  Construction:    'bg-blue-600',
  'Financial Close': 'bg-yellow-600',
  Pipeline:        'bg-gray-500',
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export default function CleanEnergyFinanceAnalytics() {
  const [data, setData] = useState<CEFDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCleanEnergyFinanceDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-red-400 text-sm">{error ?? 'No data'}</div>
      </div>
    )
  }

  const { investments, green_bonds, financing_costs, portfolio_performance, blended_finance, summary } = data

  // Investment by technology
  const techInvMap: Record<string, number> = {}
  investments.forEach((r: CEFInvestmentRecord) => {
    techInvMap[r.technology] = (techInvMap[r.technology] ?? 0) + r.total_investment_m
  })
  const techInvData = Object.entries(techInvMap)
    .map(([tech, total]) => ({ tech, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // WACC trends by technology (6 techs, 2020-2024)
  const topFinTechs = ['Solar PV', 'Wind', 'Battery Storage', 'Green Hydrogen', 'Transmission', 'Pumped Hydro']
  const waccByYear: Record<number, Record<string, number>> = {}
  financing_costs.forEach((r) => {
    if (!waccByYear[r.year]) waccByYear[r.year] = { year: r.year }
    waccByYear[r.year][r.technology] = r.wacc_pct
  })
  const waccTrendData = Object.values(waccByYear).sort((a, b) => (a as any).year - (b as any).year)

  // Green bonds by type
  const bondTypeMap: Record<string, number> = {}
  green_bonds.forEach((b) => {
    bondTypeMap[b.bond_type] = (bondTypeMap[b.bond_type] ?? 0) + b.face_value_m
  })
  const bondTypeData = Object.entries(bondTypeMap).map(([type, total]) => ({
    type,
    total: Math.round(total),
  }))

  // Portfolio scatter: IRR vs MOIC
  const scatterData = portfolio_performance.map((p) => ({
    irr: p.irr_pct,
    moic: p.moic,
    fund: p.fund_name,
  }))

  // Top 10 investments by size
  const top10Inv = [...investments]
    .sort((a, b) => b.total_investment_m - a.total_investment_m)
    .slice(0, 10)

  // Top 8 blended finance by mobilised private
  const top8Blended = [...blended_finance]
    .sort((a: CEFBlendedFinanceRecord, b: CEFBlendedFinanceRecord) => b.mobilised_private_m - a.mobilised_private_m)
    .slice(0, 8)

  return (
    <div className="min-h-full bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <DollarSign className="text-green-400" size={28} />
        <div>
          <h1 className="text-xl font-bold">Clean Energy Finance Analytics</h1>
          <p className="text-xs text-gray-400">CEFC portfolio, green bonds, blended finance &amp; WACC trends</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total CEFC Portfolio"
          value={`$${(summary.total_cefc_portfolio_m / 1000).toFixed(1)}B`}
          sub="CEFC debt + equity deployed"
        />
        <KpiCard
          label="Green Bonds Issued"
          value={`$${(summary.total_green_bonds_issued_m / 1000).toFixed(1)}B`}
          sub="Cumulative face value"
        />
        <KpiCard
          label="Avg WACC"
          value={`${summary.avg_wacc_pct?.toFixed(2)}%`}
          sub="Across all technologies 2020-2024"
        />
        <KpiCard
          label="Mobilised Private Capital"
          value={`$${(summary.total_mobilised_private_m / 1000).toFixed(1)}B`}
          sub="Via blended finance structures"
        />
      </div>

      {/* Row 1: Investment by tech + WACC trend */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Investment by Technology (AUD M)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={techInvData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="tech" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `$${v}M`} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                formatter={(v: number) => [`$${v.toLocaleString()}M`, 'Total Investment']}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {techInvData.map((entry) => (
                  <rect key={entry.tech} fill={TECH_COLORS[entry.tech] ?? '#60a5fa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">WACC Trends 2020–2024 by Technology (%)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={waccTrendData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} domain={[4, 14]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                formatter={(v: number) => [`${v?.toFixed(2)}%`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {topFinTechs.map((tech) => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={TECH_COLORS[tech] ?? '#60a5fa'}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Green bonds by type + Portfolio scatter */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Green Bonds by Type (AUD M Face Value)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bondTypeData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `$${v}M`} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 11, fill: '#9ca3af' }} width={100} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                formatter={(v: number) => [`$${v.toLocaleString()}M`, 'Face Value']}
              />
              <Bar dataKey="total" fill="#34d399" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Portfolio IRR vs MOIC</h2>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="irr" name="IRR %" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${v}%`} label={{ value: 'IRR (%)', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 11 }} />
              <YAxis dataKey="moic" name="MOIC" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${v}x`} label={{ value: 'MOIC', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                formatter={(v: number, name: string) => [name === 'MOIC' ? `${v}x` : `${v}%`, name]}
              />
              <Scatter data={scatterData} fill="#a78bfa" opacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 Investments Table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-4">Top 10 Investments by Total Size</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3">Project</th>
                <th className="text-left py-2 pr-3">Technology</th>
                <th className="text-left py-2 pr-3">State</th>
                <th className="text-right py-2 pr-3">Total (AUD M)</th>
                <th className="text-right py-2 pr-3">CEFC Debt (M)</th>
                <th className="text-right py-2 pr-3">Capacity (MW)</th>
                <th className="text-right py-2 pr-3">LCOE ($/MWh)</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {top10Inv.map((r: CEFInvestmentRecord) => (
                <tr key={r.investment_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 text-white font-medium">{r.project_name}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.technology}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.state}</td>
                  <td className="py-2 pr-3 text-right text-amber-400">${r.total_investment_m.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-blue-400">${r.cefc_debt_m.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{r.capacity_mw}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{r.lcoe_dolpermwh}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-white text-xs ${STATUS_COLORS[r.project_status] ?? 'bg-gray-600'}`}>
                      {r.project_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blended Finance Table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-4">Top 8 Blended Finance Structures by Mobilised Private Capital</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-3">Project</th>
                <th className="text-left py-2 pr-3">Structure Type</th>
                <th className="text-right py-2 pr-3">Total Size (M)</th>
                <th className="text-right py-2 pr-3">Leverage</th>
                <th className="text-right py-2 pr-3">Mobilised (M)</th>
                <th className="text-right py-2 pr-3">IRR Unblended</th>
                <th className="text-right py-2 pr-3">IRR Blended</th>
                <th className="text-left py-2">Development Impact</th>
              </tr>
            </thead>
            <tbody>
              {top8Blended.map((r: CEFBlendedFinanceRecord) => (
                <tr key={r.structure_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 pr-3 text-white font-medium">{r.project_name}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.structure_type}</td>
                  <td className="py-2 pr-3 text-right text-amber-400">${r.total_size_m.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{r.leverage_ratio}x</td>
                  <td className="py-2 pr-3 text-right text-green-400">${r.mobilised_private_m.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right text-red-400">{r.irr_unblended_pct}%</td>
                  <td className="py-2 pr-3 text-right text-green-400">{r.irr_blended_pct}%</td>
                  <td className="py-2 text-gray-400 max-w-xs truncate">{r.development_impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
