import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { DollarSign, AlertTriangle, Zap } from 'lucide-react'
import { getVollAnalyticsDashboard, VollAnalyticsDashboard } from '../api/client'

// ── Colour palette ─────────────────────────────────────────────────────────
const REGION_COLOURS: Record<string, string> = {
  NSW: '#10b981',
  VIC: '#3b82f6',
  QLD: '#f59e0b',
  SA:  '#f43f5e',
  TAS: '#8b5cf6',
}

const SENSITIVITY_STYLES: Record<string, string> = {
  HIGH:   'bg-red-900 text-red-200',
  MEDIUM: 'bg-yellow-900 text-yellow-200',
  LOW:    'bg-green-900 text-green-200',
}

const METHODOLOGY_COLOURS: Record<string, string> = {
  SURVEY:               '#10b981',
  REVEALED_PREFERENCE:  '#3b82f6',
  HYBRID:               '#f59e0b',
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, colour }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; colour: string
}) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border-l-4 ${colour}`}>
      <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── Section heading ────────────────────────────────────────────────────────
function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-base font-semibold text-gray-200 mb-3 mt-6 border-b border-gray-700 pb-1">
      {title}
    </h2>
  )
}

// ── Formatters ────────────────────────────────────────────────────────────
function fmtAUD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v.toLocaleString()}`
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function VollAnalytics() {
  const [data, setData] = useState<VollAnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getVollAnalyticsDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Loading VoLL Analytics…</p>
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-red-400">Error: {error ?? 'No data'}</p>
    </div>
  )

  // ── Derived KPI values ────────────────────────────────────────────────
  // Latest regulatory VoLL (most recent year, any methodology)
  const latestYear = Math.max(...data.voll_estimates.map((r: any) => r.year))
  const latestVollRecords = data.voll_estimates.filter((r: any) => r.year === latestYear)
  const regulatoryVoll = latestVollRecords.length > 0
    ? latestVollRecords[0].nem_regulatory_voll_aud_mwh as number
    : 0

  // Total 2024 outage costs across all regions
  const outage2024 = data.outage_costs.filter((r: any) => r.year === 2024)
  const totalOutageCost2024 = outage2024.reduce((sum: number, r: any) => sum + r.total_economic_cost_m_aud, 0)

  // Highest-cost sector
  const topSector = [...data.industry_sectors].sort(
    (a: any, b: any) => b.avg_outage_cost_aud_hour - a.avg_outage_cost_aud_hour
  )[0]

  // Average BCR for reliability investments
  const avgBCR = data.reliability_values.length > 0
    ? (data.reliability_values.reduce((sum: number, r: any) => sum + r.benefit_cost_ratio, 0) / data.reliability_values.length).toFixed(2)
    : '—'

  // ── VoLL comparison bar chart data: group by year, bar per methodology ──
  const vollYears = [...new Set(data.voll_estimates.map((r: any) => r.year))].sort()
  const vollBarData = vollYears.map(year => {
    const row: any = { year }
    data.voll_estimates
      .filter((r: any) => r.year === year)
      .forEach((r: any) => {
        row[`residential_${r.methodology}`] = r.residential_voll_aud_mwh
        row[`commercial_${r.methodology}`]  = r.commercial_voll_aud_mwh
        row[`industrial_${r.methodology}`]  = r.industrial_voll_aud_mwh
        row['regulatory'] = r.nem_regulatory_voll_aud_mwh
      })
    return row
  })

  // ── Outage cost trend data: total economic cost by region per year ──────
  const outageYears = [...new Set(data.outage_costs.map((r: any) => r.year))].sort()
  const regions = [...new Set(data.outage_costs.map((r: any) => r.region))]
  const outageTrendData = outageYears.map(year => {
    const row: any = { year }
    regions.forEach(region => {
      const rec = data.outage_costs.find((r: any) => r.year === year && r.region === region)
      if (rec) row[region] = rec.total_economic_cost_m_aud
    })
    return row
  })

  // ── Scatter: x=SAIDI improvement (current - target), y=VoLL saved, z=investment cost
  const scatterData = data.reliability_values.map((r: any) => ({
    name: r.region,
    x: parseFloat((r.current_saidi_min - r.target_saidi_min).toFixed(1)),
    y: r.voll_saved_m_aud,
    z: r.improvement_cost_m_aud,
    bcr: r.benefit_cost_ratio,
  }))

  // ── Unique methodologies for bar chart legend ──────────────────────────
  const methodologies = [...new Set(data.voll_estimates.map((r: any) => r.methodology as string))]

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 px-4 py-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <DollarSign className="w-6 h-6 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">
            Power Outage Economic Cost — VoLL Analytics
          </h1>
        </div>
        <p className="text-gray-400 text-sm ml-9">
          Value of Lost Load (VoLL) methodology, sectoral cost of outages, and economic cost estimates
          by NEM region and customer class.
        </p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <KpiCard
          icon={<DollarSign className="w-3 h-3" />}
          label="NEM Regulatory VoLL"
          value={`$${(regulatoryVoll / 1000).toFixed(1)}k/MWh`}
          sub={`FY${latestYear} AEMC determination`}
          colour="border-emerald-500"
        />
        <KpiCard
          icon={<AlertTriangle className="w-3 h-3" />}
          label="2024 Total Outage Costs"
          value={`$${totalOutageCost2024.toFixed(0)}M`}
          sub="All NEM regions combined"
          colour="border-red-500"
        />
        <KpiCard
          icon={<Zap className="w-3 h-3" />}
          label="Highest-Cost Sector"
          value={fmtAUD(topSector?.avg_outage_cost_aud_hour ?? 0) + '/hr'}
          sub={topSector?.sector ?? '—'}
          colour="border-yellow-500"
        />
        <KpiCard
          icon={<DollarSign className="w-3 h-3" />}
          label="Avg Reliability BCR"
          value={String(avgBCR)}
          sub="Benefit-cost ratio, NEM average"
          colour="border-blue-500"
        />
      </div>

      {/* ── VoLL Estimate Comparison Bar Chart ─────────────────────────── */}
      <SectionHeading title="VoLL Estimates by Customer Class, Year & Methodology (AUD/MWh)" />
      <div className="bg-gray-800 rounded-xl p-4 mb-2">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={vollBarData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value: number, name: string) => [
                `$${value.toLocaleString()}/MWh`,
                name.replace(/_/g, ' ')
              ]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {methodologies.flatMap(m => [
              <Bar key={`res_${m}`} dataKey={`residential_${m}`} name={`Residential (${m.replace(/_/g, ' ')})`} fill={METHODOLOGY_COLOURS[m] ?? '#6b7280'} opacity={0.9} />,
              <Bar key={`com_${m}`} dataKey={`commercial_${m}`}  name={`Commercial (${m.replace(/_/g, ' ')})`}  fill={METHODOLOGY_COLOURS[m] ?? '#6b7280'} opacity={0.6} />,
              <Bar key={`ind_${m}`} dataKey={`industrial_${m}`}  name={`Industrial (${m.replace(/_/g, ' ')})`}  fill={METHODOLOGY_COLOURS[m] ?? '#6b7280'} opacity={0.35} />,
            ])}
            <ReferenceLine y={regulatoryVoll} stroke="#f43f5e" strokeDasharray="6 3"
              label={{ value: 'NEM Regulatory VoLL', fill: '#f43f5e', fontSize: 11, position: 'insideTopRight' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Outage Cost Trend Line Chart ────────────────────────────────── */}
      <SectionHeading title="Total Economic Cost of Outages by Region (M AUD)" />
      <div className="bg-gray-800 rounded-xl p-4 mb-2">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={outageTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v) => `$${v}M`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value: number, name: string) => [`$${value.toFixed(0)}M`, name]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            {regions.map(region => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                name={region}
                stroke={REGION_COLOURS[region] ?? '#6b7280'}
                strokeWidth={2}
                dot={{ r: 4, fill: REGION_COLOURS[region] ?? '#6b7280' }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Industry Sector Sensitivity Table ──────────────────────────── */}
      <SectionHeading title="Industry Sector Outage Sensitivity" />
      <div className="bg-gray-800 rounded-xl overflow-hidden mb-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-700 text-gray-300 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Sector</th>
              <th className="text-right px-4 py-3">Cost (AUD/hr)</th>
              <th className="text-center px-4 py-3">Sensitivity</th>
              <th className="text-right px-4 py-3">Critical Threshold</th>
              <th className="text-right px-4 py-3">Annual Exposure</th>
              <th className="text-right px-4 py-3">Backup Adoption</th>
            </tr>
          </thead>
          <tbody>
            {[...data.industry_sectors]
              .sort((a: any, b: any) => b.avg_outage_cost_aud_hour - a.avg_outage_cost_aud_hour)
              .map((s: any, i: number) => (
                <tr key={s.sector}
                  className={`border-t border-gray-700 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'} hover:bg-gray-700 transition-colors`}>
                  <td className="px-4 py-3 text-gray-200 font-medium">{s.sector}</td>
                  <td className="px-4 py-3 text-right text-white font-mono">
                    {fmtAUD(s.avg_outage_cost_aud_hour)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${SENSITIVITY_STYLES[s.outage_sensitivity] ?? 'bg-gray-700 text-gray-300'}`}>
                      {s.outage_sensitivity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {s.critical_threshold_min < 60
                      ? `${s.critical_threshold_min} min`
                      : `${(s.critical_threshold_min / 60).toFixed(0)} hr`}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    ${s.annual_exposure_m_aud.toLocaleString()}M
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${s.backup_power_adoption_pct}%` }}
                        />
                      </div>
                      <span className="text-gray-300 text-xs w-10 text-right">
                        {s.backup_power_adoption_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Reliability Investment Value Scatter ────────────────────────── */}
      <SectionHeading title="Reliability Investment Value: SAIDI Improvement vs VoLL Saved (bubble size = investment M AUD)" />
      <div className="bg-gray-800 rounded-xl p-4 mb-2">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number" dataKey="x" name="SAIDI Reduction (min)"
              stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'SAIDI Reduction (min)', position: 'insideBottom', offset: -5, fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              type="number" dataKey="y" name="VoLL Saved (M AUD)"
              stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v) => `$${v}M`}
              label={{ value: 'VoLL Saved (M AUD)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="z" range={[80, 600]} name="Investment (M AUD)" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const d = payload[0]?.payload
                return (
                  <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs text-gray-200">
                    <p className="font-bold text-white mb-1">{d.name}</p>
                    <p>SAIDI Reduction: <span className="text-emerald-400">{d.x} min</span></p>
                    <p>VoLL Saved: <span className="text-yellow-400">${d.y}M</span></p>
                    <p>Investment: <span className="text-blue-400">${d.z}M</span></p>
                    <p>BCR: <span className="text-purple-400">{d.bcr}x</span></p>
                  </div>
                )
              }}
            />
            <Scatter
              name="NEM Regions"
              data={scatterData}
              shape={(props: any) => {
                const { cx, cy, r } = props
                const colour = REGION_COLOURS[props.payload?.name] ?? '#6b7280'
                return (
                  <g>
                    <circle cx={cx} cy={cy} r={r} fill={colour} fillOpacity={0.7} stroke={colour} strokeWidth={1.5} />
                    <text x={cx} y={cy - r - 4} textAnchor="middle" fill={colour} fontSize={11} fontWeight="600">
                      {props.payload?.name}
                    </text>
                  </g>
                )
              }}
            >
              {scatterData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={REGION_COLOURS[entry.name] ?? '#6b7280'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* ── Footer timestamp ────────────────────────────────────────────── */}
      <p className="text-center text-gray-600 text-xs mt-6">
        Data as of {new Date(data.timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST
        &nbsp;|&nbsp; Sources: AEMC VoLL Reviews, AEMO Annual Market Performance Reports
      </p>
    </div>
  )
}
