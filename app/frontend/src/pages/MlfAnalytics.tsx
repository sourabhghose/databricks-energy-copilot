import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { TrendingDown, BarChart2, Zap } from 'lucide-react'
import { getMlfAnalyticsDashboard, MlfAnalyticsDashboard } from '../api/client'

const REGION_COLORS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#10b981',
  QLD: '#f59e0b',
  SA:  '#ef4444',
  TAS: '#8b5cf6',
}

const TECH_COLORS: Record<string, string> = {
  Solar:       '#f59e0b',
  Wind:        '#3b82f6',
  'Hydro Pumped': '#8b5cf6',
  Hydro:       '#06b6d4',
  Battery:     '#10b981',
}

const TREND_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  DECLINING:  { label: 'Declining',  bg: 'bg-red-900',   text: 'text-red-300'   },
  IMPROVING:  { label: 'Improving',  bg: 'bg-green-900', text: 'text-green-300' },
  STABLE:     { label: 'Stable',     bg: 'bg-gray-700',  text: 'text-gray-300'  },
}

const RISK_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  HIGH:   { label: 'High',   bg: 'bg-red-900',    text: 'text-red-300'    },
  MEDIUM: { label: 'Medium', bg: 'bg-amber-900',  text: 'text-amber-300'  },
  LOW:    { label: 'Low',    bg: 'bg-green-900',  text: 'text-green-300'  },
}

function Badge({ style }: { style: { label: string; bg: string; text: string } }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}

function TechBadge({ tech }: { tech: string }) {
  const color = TECH_COLORS[tech] ?? '#6b7280'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '33', color }}
    >
      {tech}
    </span>
  )
}

function fmt2(v: number) { return v.toFixed(3) }
function fmtPct(v: number) {
  return v >= 0 ? `+${v.toFixed(1)}%` : `${v.toFixed(1)}%`
}

export default function MlfAnalytics() {
  const [data, setData] = useState<MlfAnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMlfAnalyticsDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading MLF analytics data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error: {error ?? 'No data'}
      </div>
    )
  }

  const cps = data.connection_points
  const rezs = data.rez_mlfs
  const impacts = data.revenue_impacts
  const historical = data.historical

  // KPI derivations
  const lowestMlf2024 = [...cps].sort((a, b) => a.mlf_2024 - b.mlf_2024)[0]
  const highestRevLoss = [...impacts].sort((a, b) => b.revenue_loss_m_aud - a.revenue_loss_m_aud)[0]
  const highRiskRezs = rezs.filter((r: any) => r.risk_level === 'HIGH').length
  const genBelow095 = cps.filter((r: any) => r.mlf_2024 < 0.95).length

  // Scatter data: x=mlf_value, y=revenue_loss_pct, z=capacity_mw
  const scatterData = impacts.map((r: any) => ({
    x: r.mlf_value,
    y: r.revenue_loss_pct,
    z: r.capacity_mw,
    name: r.generator_name,
    tech: r.technology,
  }))

  // Historical line chart: pivot by region
  const years = [2021, 2022, 2023, 2024]
  const regions = ['NSW', 'VIC', 'QLD', 'SA', 'TAS']
  const historicalByYear = years.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    regions.forEach(reg => {
      const match = historical.find((h: any) => h.year === yr && h.region === reg)
      if (match) row[reg] = match.avg_mlf
    })
    return row
  })

  return (
    <div className="p-6 space-y-6 text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingDown className="w-7 h-7 text-red-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Marginal Loss Factor (MLF) Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Connection point MLFs, generator revenue impact, REZ challenges, and historical trends
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Lowest MLF 2024</span>
          </div>
          <div className="text-2xl font-bold text-red-300">{lowestMlf2024.mlf_2024.toFixed(3)}</div>
          <div className="text-xs text-gray-400 mt-1">{lowestMlf2024.generator_name}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Highest Revenue Loss</span>
          </div>
          <div className="text-2xl font-bold text-orange-300">
            ${highestRevLoss.revenue_loss_m_aud.toFixed(1)}M
          </div>
          <div className="text-xs text-gray-400 mt-1">{highestRevLoss.generator_name}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">REZs at HIGH Risk</span>
          </div>
          <div className="text-2xl font-bold text-red-300">{highRiskRezs}</div>
          <div className="text-xs text-gray-400 mt-1">of {rezs.length} total REZs</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Generators Below 0.95</span>
          </div>
          <div className="text-2xl font-bold text-amber-300">{genBelow095}</div>
          <div className="text-xs text-gray-400 mt-1">of {cps.length} connection points</div>
        </div>
      </div>

      {/* Connection Point MLF Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">Connection Point MLF Summary</h2>
          <p className="text-xs text-gray-400 mt-0.5">MLF values by year, trend, and revenue impact</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700 bg-gray-900">
                <th className="text-left px-4 py-2">Generator</th>
                <th className="text-left px-4 py-2">Technology</th>
                <th className="text-left px-4 py-2">Region</th>
                <th className="text-right px-4 py-2">MLF 2022</th>
                <th className="text-right px-4 py-2">MLF 2023</th>
                <th className="text-right px-4 py-2">MLF 2024</th>
                <th className="text-center px-4 py-2">Trend</th>
                <th className="text-right px-4 py-2">Rev Impact</th>
              </tr>
            </thead>
            <tbody>
              {cps.map((cp: any, i: number) => (
                <tr
                  key={cp.connection_point}
                  className={`border-b border-gray-700 hover:bg-gray-750 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-white">{cp.generator_name}</div>
                    <div className="text-xs text-gray-500">{cp.connection_point}</div>
                  </td>
                  <td className="px-4 py-2">
                    <TechBadge tech={cp.technology} />
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="font-semibold text-xs"
                      style={{ color: REGION_COLORS[cp.region] ?? '#9ca3af' }}
                    >
                      {cp.region}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300">{fmt2(cp.mlf_2022)}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{fmt2(cp.mlf_2023)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${cp.mlf_2024 < 0.95 ? 'text-red-300' : cp.mlf_2024 > 1.0 ? 'text-green-300' : 'text-gray-200'}`}>
                    {fmt2(cp.mlf_2024)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge style={TREND_STYLES[cp.mlf_trend] ?? TREND_STYLES['STABLE']} />
                  </td>
                  <td className={`px-4 py-2 text-right font-semibold ${cp.revenue_impact_pct < 0 ? 'text-red-300' : 'text-green-300'}`}>
                    {fmtPct(cp.revenue_impact_pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* REZ MLF Risk Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">REZ MLF Risk Assessment</h2>
          <p className="text-xs text-gray-400 mt-0.5">Current vs projected 2028 MLF, capacity pipeline, and AEMO mitigation measures</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-700 bg-gray-900">
                <th className="text-left px-4 py-2">REZ</th>
                <th className="text-left px-4 py-2">Region</th>
                <th className="text-right px-4 py-2">Current MLF</th>
                <th className="text-right px-4 py-2">Proj. 2028</th>
                <th className="text-right px-4 py-2">Deterioration</th>
                <th className="text-right px-4 py-2">Connected MW</th>
                <th className="text-right px-4 py-2">Pipeline MW</th>
                <th className="text-center px-4 py-2">Risk</th>
                <th className="text-left px-4 py-2">AEMO Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {rezs.map((rez: any, i: number) => (
                <tr
                  key={rez.rez_id}
                  className={`border-b border-gray-700 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'} hover:bg-gray-750`}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-white">{rez.rez_name}</div>
                    <div className="text-xs text-gray-500">{rez.rez_id}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-semibold text-xs" style={{ color: REGION_COLORS[rez.region] ?? '#9ca3af' }}>
                      {rez.region}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300">{fmt2(rez.current_mlf)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${rez.projected_mlf_2028 < 0.88 ? 'text-red-300' : rez.projected_mlf_2028 < 0.92 ? 'text-amber-300' : 'text-gray-200'}`}>
                    {fmt2(rez.projected_mlf_2028)}
                  </td>
                  <td className="px-4 py-2 text-right text-red-300 font-semibold">
                    {rez.mlf_deterioration_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300">
                    {rez.connected_capacity_mw.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-amber-300">
                    {rez.pipeline_capacity_mw.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge style={RISK_STYLES[rez.risk_level] ?? RISK_STYLES['LOW']} />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400 max-w-48">{rez.aemo_mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Impact Scatter + Historical Trend side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue Impact Scatter */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h2 className="text-base font-semibold text-white mb-1">Revenue Loss vs MLF</h2>
          <p className="text-xs text-gray-400 mb-4">
            Bubble size = capacity MW; colour = technology type
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="x"
                type="number"
                name="MLF"
                domain={[0.85, 1.05]}
                tickFormatter={v => v.toFixed(2)}
                label={{ value: 'MLF Value', position: 'insideBottom', offset: -15, fill: '#9ca3af', fontSize: 12 }}
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                name="Revenue Loss %"
                tickFormatter={v => `${v.toFixed(0)}%`}
                label={{ value: 'Revenue Loss %', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12 }}
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <ZAxis dataKey="z" range={[40, 600]} name="Capacity MW" />
              <ReferenceLine x={0.95} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'MLF 0.95', fill: '#ef4444', fontSize: 11 }} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(value: any, name: string) => {
                  if (name === 'Revenue Loss %') return [`${(value as number).toFixed(1)}%`, name]
                  if (name === 'Capacity MW') return [`${value} MW`, name]
                  return [value, name]
                }}
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-gray-900 border border-gray-600 rounded p-2 text-xs">
                      <div className="font-semibold text-white mb-1">{d.name}</div>
                      <div className="text-gray-300">MLF: {d.x.toFixed(3)}</div>
                      <div className="text-gray-300">Revenue Loss: {d.y.toFixed(1)}%</div>
                      <div className="text-gray-300">Capacity: {d.z} MW</div>
                      <div className="text-gray-400">{d.tech}</div>
                    </div>
                  )
                }}
              />
              {Object.entries(TECH_COLORS).map(([tech, color]) => {
                const techData = scatterData.filter(d => d.tech === tech)
                if (!techData.length) return null
                return (
                  <Scatter key={tech} name={tech} data={techData} fill={color} opacity={0.8} />
                )
              })}
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#9ca3af', paddingTop: '8px' }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Historical MLF Trend Line Chart */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h2 className="text-base font-semibold text-white mb-1">Historical Average MLF by Region</h2>
          <p className="text-xs text-gray-400 mb-4">
            Average MLF 2021-2024 with 0.95 threshold reference
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={historicalByYear} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="year"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <YAxis
                domain={[0.87, 1.01]}
                tickFormatter={v => v.toFixed(2)}
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
              />
              <ReferenceLine
                y={0.95}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ value: '0.95 threshold', position: 'insideTopRight', fill: '#ef4444', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(value: any, name: string) => [
                  typeof value === 'number' ? value.toFixed(3) : value,
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              {regions.map(reg => (
                <Line
                  key={reg}
                  type="monotone"
                  dataKey={reg}
                  stroke={REGION_COLORS[reg]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: REGION_COLORS[reg] }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Impact Bar Chart */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="text-base font-semibold text-white mb-1">Annual Revenue Loss by Generator (M AUD)</h2>
        <p className="text-xs text-gray-400 mb-4">
          Revenue loss attributable to sub-unity MLF — sorted by impact magnitude
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={[...impacts]
              .filter((r: any) => r.revenue_loss_m_aud > 0)
              .sort((a: any, b: any) => b.revenue_loss_m_aud - a.revenue_loss_m_aud)}
            margin={{ top: 10, right: 20, bottom: 60, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="generator_name"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tickFormatter={v => `$${v}M`}
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(value: any) => [`$${(value as number).toFixed(1)}M`, 'Revenue Loss']}
            />
            <Bar dataKey="revenue_loss_m_aud" name="Revenue Loss M AUD" radius={[3, 3, 0, 0]}>
              {[...impacts]
                .filter((r: any) => r.revenue_loss_m_aud > 0)
                .sort((a: any, b: any) => b.revenue_loss_m_aud - a.revenue_loss_m_aud)
                .map((entry: any) => (
                  <Cell key={entry.generator_name} fill={TECH_COLORS[entry.technology] ?? '#6b7280'} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {Object.entries(TECH_COLORS).map(([tech, color]) => (
            <div key={tech} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400">{tech}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer timestamp */}
      <div className="text-xs text-gray-600 text-right">
        Data as of: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  )
}
