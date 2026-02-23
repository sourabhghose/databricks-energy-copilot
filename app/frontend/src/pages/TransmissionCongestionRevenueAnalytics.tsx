import { useEffect, useState } from 'react'
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
  Cell,
} from 'recharts'
import { GitBranch } from 'lucide-react'
import {
  getTransmissionCongestionRevenueDashboard,
  TCRADashboard,
  TCRAMitigationProject,
} from '../api/client'

// ── Colour palettes ────────────────────────────────────────────────────────
const IC_COLOURS: Record<string, string> = {
  'VIC1-NSW1': '#6366f1',
  'SA1-VIC1':  '#f59e0b',
  'NSW1-QLD1': '#10b981',
  'VIC1-TAS1': '#3b82f6',
  'SA1-NSW1':  '#ec4899',
}

const DRIVER_COLOURS: Record<string, string> = {
  Thermal:       '#ef4444',
  Stability:     '#f59e0b',
  Voltage:       '#3b82f6',
  'Short Circuit': '#8b5cf6',
}

const SECTOR_COLOURS: Record<string, string> = {
  Generator: '#6366f1',
  Load:      '#f59e0b',
  Network:   '#10b981',
}

const STATUS_COLOURS: Record<string, string> = {
  Operating:             '#10b981',
  'Under Construction':  '#3b82f6',
  Approved:              '#f59e0b',
  Proposed:              '#8b5cf6',
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h2>
      {children}
    </div>
  )
}

// ── Custom scatter dot (coloured by project status) ────────────────────────
function StatusDot(props: {
  cx?: number; cy?: number; payload?: TCRAMitigationProject
}) {
  const { cx = 0, cy = 0, payload } = props
  const colour = STATUS_COLOURS[payload?.status ?? ''] ?? '#6b7280'
  return <circle cx={cx} cy={cy} r={7} fill={colour} fillOpacity={0.85} stroke="#fff" strokeWidth={1} />
}

export default function TransmissionCongestionRevenueAnalytics() {
  const [data, setData] = useState<TCRADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTransmissionCongestionRevenueDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading Transmission Congestion Revenue Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const { summary, interconnector_revenues, constraint_groups, congestion_costs, mitigation_projects } = data

  // ── Chart 1: stacked bar — congestion_revenue_m by interconnector × year ──
  const years = [2021, 2022, 2023, 2024]
  const chart1Data = years.map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    for (const iid of Object.keys(IC_COLOURS)) {
      row[iid] = Math.round(
        interconnector_revenues
          .filter(r => r.year === yr && r.interconnector_id === iid)
          .reduce((s, r) => s + r.congestion_revenue_m, 0) * 10) / 10
    }
    return row
  })

  // ── Chart 2: line — avg_price_spread by quarter (2024) per interconnector ─
  const chart2Data = [1, 2, 3, 4].map(q => {
    const row: Record<string, number | string> = { quarter: `Q${q}` }
    for (const iid of Object.keys(IC_COLOURS)) {
      const rec = interconnector_revenues.find(r => r.year === 2024 && r.quarter === q && r.interconnector_id === iid)
      row[iid] = rec ? Math.round(rec.avg_price_spread_aud_mwh * 100) / 100 : 0
    }
    return row
  })

  // ── Chart 3: bar — congestion_rent_m by constraint_set (2024) ─────────────
  const allConstraintSets = [...new Set(constraint_groups.map(c => c.constraint_set))]
  const chart3Data = allConstraintSets.map(cs => {
    const recs = constraint_groups.filter(c => c.constraint_set === cs && c.year === 2024)
    const rec = recs[0]
    return {
      constraint_set: cs,
      congestion_rent_m: rec ? Math.round(rec.congestion_rent_m * 100) / 100 : 0,
      constraint_driver: rec?.constraint_driver ?? 'Thermal',
    }
  }).sort((a, b) => b.congestion_rent_m - a.congestion_rent_m)

  // ── Chart 4: stacked bar — sector congestion costs by region (2024) ────────
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const chart4Data = regions.map(reg => {
    const row: Record<string, number | string> = { region: reg }
    for (const sector of ['Generator', 'Load', 'Network']) {
      const rec = congestion_costs.find(c => c.region === reg && c.year === 2024 && c.sector === sector)
      row[sector] = rec ? Math.round(rec.congestion_cost_m * 100) / 100 : 0
    }
    return row
  })

  // ── Chart 5: scatter — capex vs relief_pa (coloured by status) ─────────────
  const chart5Data = mitigation_projects.map(mp => ({
    ...mp,
    x: mp.capex_m,
    y: mp.congestion_relief_m_pa,
  }))

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
          <GitBranch className="text-indigo-600 dark:text-indigo-400" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Transmission Congestion Revenue Analytics
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            NEM interconnector congestion revenue, constraint analysis, and mitigation pipeline
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Congestion Revenue FY"
          value={`$${summary.total_congestion_revenue_fy_m.toFixed(1)}M`}
          sub="2024 financial year"
        />
        <KpiCard
          label="Most Congested Interconnector"
          value={summary.most_congested_interconnector}
          sub="Highest FY2024 congestion revenue"
        />
        <KpiCard
          label="Avg Price Spread"
          value={`$${summary.avg_price_spread_aud_mwh.toFixed(2)}/MWh`}
          sub="2024 average across interconnectors"
        />
        <KpiCard
          label="Pipeline Mitigation Capex"
          value={`$${summary.total_mitigation_pipeline_capex_m.toFixed(0)}M`}
          sub="Approved & proposed projects"
        />
        <KpiCard
          label="Consumer Congestion Cost"
          value={`$${summary.annualised_consumer_congestion_cost_m.toFixed(1)}M`}
          sub="Annualised 2024 impact"
        />
      </div>

      {/* Chart row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1 */}
        <Section title="Annual Congestion Revenue by Interconnector ($M)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart1Data} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit="M" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: number) => [`$${v.toFixed(1)}M`]}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {Object.keys(IC_COLOURS).map(iid => (
                <Bar key={iid} dataKey={iid} stackId="a" fill={IC_COLOURS[iid]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* Chart 2 */}
        <Section title="2024 Avg Price Spread by Quarter ($/MWh)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart2Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" $/MWh" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: number) => [`$${v.toFixed(2)}/MWh`]}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {Object.keys(IC_COLOURS).map(iid => (
                <Line
                  key={iid}
                  type="monotone"
                  dataKey={iid}
                  stroke={IC_COLOURS[iid]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Chart row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3 */}
        <Section title="2024 Congestion Rent by Constraint Set ($M, coloured by driver)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart3Data} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} unit="M" />
              <YAxis
                type="category"
                dataKey="constraint_set"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                width={90}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: number, _name: string, entry) => [
                  `$${v.toFixed(2)}M`,
                  entry?.payload?.constraint_driver ?? 'N/A',
                ]}
              />
              <Bar dataKey="congestion_rent_m" name="Congestion Rent ($M)">
                {chart3Data.map((entry, idx) => (
                  <Cell key={idx} fill={DRIVER_COLOURS[entry.constraint_driver] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* driver legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(DRIVER_COLOURS).map(([d, c]) => (
              <span key={d} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />
                {d}
              </span>
            ))}
          </div>
        </Section>

        {/* Chart 4 */}
        <Section title="2024 Congestion Cost by Region & Sector ($M)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart4Data} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="region" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit="M" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: number, name: string) => [`$${v.toFixed(2)}M`, name]}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {Object.keys(SECTOR_COLOURS).map(sector => (
                <Bar key={sector} dataKey={sector} stackId="s" fill={SECTOR_COLOURS[sector]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Chart 5 — scatter */}
      <Section title="Mitigation Projects: Capex vs Annual Congestion Relief (coloured by status)">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="x"
              name="Capex ($M)"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              unit="M"
              label={{ value: 'Capex ($M)', position: 'insideBottom', offset: -4, fill: '#9ca3af', fontSize: 11 }}
            />
            <YAxis
              dataKey="y"
              name="Relief ($M/yr)"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              unit="M"
              label={{ value: 'Relief ($/yr)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as TCRAMitigationProject
                return (
                  <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-200 space-y-1">
                    <p className="font-semibold">{p.project_name}</p>
                    <p>Interconnector: {p.interconnector_id}</p>
                    <p>Type: {p.project_type}</p>
                    <p>Capex: ${p.capex_m}M</p>
                    <p>Annual Relief: ${p.congestion_relief_m_pa}M/yr</p>
                    <p>Payback: {p.payback_years} yrs</p>
                    <p>Status: <span style={{ color: STATUS_COLOURS[p.status] }}>{p.status}</span></p>
                  </div>
                )
              }}
            />
            <Scatter data={chart5Data} shape={<StatusDot />} />
          </ScatterChart>
        </ResponsiveContainer>
        {/* status legend */}
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(STATUS_COLOURS).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: c }} />
              {s}
            </span>
          ))}
        </div>
      </Section>

      {/* Summary dl grid */}
      <Section title="Dashboard Summary">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          {[
            ['Total FY2024 Congestion Revenue', `$${summary.total_congestion_revenue_fy_m.toFixed(2)}M`],
            ['Most Congested Interconnector', summary.most_congested_interconnector],
            ['Average Price Spread (2024)', `$${summary.avg_price_spread_aud_mwh.toFixed(2)}/MWh`],
            ['Pipeline Mitigation Capex (Approved + Proposed)', `$${summary.total_mitigation_pipeline_capex_m.toFixed(1)}M`],
            ['Annualised Consumer Congestion Cost (2024)', `$${summary.annualised_consumer_congestion_cost_m.toFixed(2)}M`],
            ['Total Interconnectors Tracked', '5'],
            ['Constraint Sets Monitored', '7'],
            ['NEM Regions Covered', '5 (NSW1, QLD1, VIC1, SA1, TAS1)'],
            ['Mitigation Projects in Pipeline', String(mitigation_projects.length)],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-gray-100 dark:border-gray-700 pb-3">
              <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
              <dd className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  )
}
