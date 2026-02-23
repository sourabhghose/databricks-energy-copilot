import { useEffect, useState } from 'react'
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
} from 'recharts'
import { Network } from 'lucide-react'
import {
  getNemCongestionRentDashboard,
  NCRADashboard,
} from '../api/client'

const INTERCONNECTOR_COLORS: Record<string, string> = {
  'VIC1-NSW1': '#6366f1',
  'SA1-VIC1':  '#f59e0b',
  'NSW1-QLD1': '#10b981',
  'VIC1-TAS1': '#3b82f6',
  'SA1-NSW1':  '#ef4444',
}

const REGION_COLORS: Record<string, string> = {
  NSW1: '#6366f1',
  QLD1: '#f59e0b',
  VIC1: '#10b981',
  SA1:  '#3b82f6',
  TAS1: '#ef4444',
}

const YEAR_COLORS: Record<number, string> = {
  2022: '#6366f1',
  2023: '#f59e0b',
  2024: '#10b981',
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-1 border border-gray-700">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white leading-tight">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

export default function NemCongestionRentAnalytics() {
  const [data, setData] = useState<NCRADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNemCongestionRentDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading NEM Congestion Rent data...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data.'}
      </div>
    )
  }

  const { interconnectors, constraints, regional_basis, distribution, summary } = data

  // ── Chart 1: Stacked bar — congestion_rent_m by interconnector × year ──────
  const interconnectorIds = ['VIC1-NSW1', 'SA1-VIC1', 'NSW1-QLD1', 'VIC1-TAS1', 'SA1-NSW1']
  const chart1Data = interconnectorIds.map((iid) => {
    const row: Record<string, string | number> = { interconnector: iid }
    for (const yr of [2022, 2023, 2024]) {
      const total = interconnectors
        .filter((r) => r.interconnector_id === iid && r.year === yr)
        .reduce((s, r) => s + r.congestion_rent_m, 0)
      row[String(yr)] = parseFloat(total.toFixed(2))
    }
    return row
  })

  // ── Chart 2: Line — utilisation_pct over months for 2024, 5 lines ──────────
  const chart2Data = MONTH_LABELS.map((mon, idx) => {
    const row: Record<string, string | number> = { month: mon }
    for (const iid of interconnectorIds) {
      const rec = interconnectors.find(
        (r) => r.interconnector_id === iid && r.year === 2024 && r.month === idx + 1
      )
      row[iid] = rec ? rec.utilisation_pct : 0
    }
    return row
  })

  // ── Chart 3: Bar — total_congestion_rent_m by constraint_id (top 8) ─────────
  const top8Constraints = [...constraints]
    .sort((a, b) => b.total_congestion_rent_m - a.total_congestion_rent_m)
    .slice(0, 8)
  const chart3Data = top8Constraints.map((c) => ({
    constraint_id: c.constraint_id,
    total_congestion_rent_m: c.total_congestion_rent_m,
    direction: c.direction,
  }))

  // ── Chart 4: Stacked bar — tnsp/market/sra shares by year-quarter ───────────
  const chart4Data = distribution.map((d) => ({
    period: `${d.year} Q${d.quarter}`,
    TNSP: d.tnsp_share_m,
    'Market Participant': d.market_participant_share_m,
    'SRA Holder': d.sra_holder_share_m,
  }))

  // ── Chart 5: Line — basis_to_nsw by month for each region (2024) ─────────────
  const regions = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1']
  const chart5Data = MONTH_LABELS.map((mon, idx) => {
    const row: Record<string, string | number> = { month: mon }
    for (const reg of regions) {
      const rec = regional_basis.find(
        (r) => r.region === reg && r.year === 2024 && r.month === idx + 1
      )
      row[reg] = rec ? rec.basis_to_nsw : 0
    }
    return row
  })

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-white">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Network className="text-indigo-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">NEM Congestion Rent Analytics</h1>
          <p className="text-sm text-gray-400">
            Interconnector flows, constraint bind hours, shadow prices and congestion rent distribution
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Congestion Rent FY"
          value={`$${summary.total_congestion_rent_fy_m.toFixed(1)}M`}
          sub="AUD millions (annual avg)"
        />
        <KpiCard
          label="Most Constrained Interconnector"
          value={summary.most_constrained_interconnector}
          sub="by bind hours"
        />
        <KpiCard
          label="Avg Bind Hours / Month"
          value={summary.avg_bind_hours_per_month.toFixed(1)}
          sub="across all constraints"
        />
        <KpiCard
          label="Peak Shadow Price"
          value={`$${summary.peak_shadow_price.toFixed(2)}/MWh`}
          sub="highest avg shadow price"
        />
      </div>

      {/* Chart 1: Congestion rent by interconnector × year */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Annual Congestion Rent by Interconnector ($M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart1Data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="interconnector" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`$${v.toFixed(1)}M`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {[2022, 2023, 2024].map((yr) => (
              <Bar key={yr} dataKey={String(yr)} stackId="a" fill={YEAR_COLORS[yr]} name={String(yr)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Utilisation % over months 2024 */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Interconnector Utilisation % — 2024 (Monthly)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chart2Data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {interconnectorIds.map((iid) => (
              <Line
                key={iid}
                type="monotone"
                dataKey={iid}
                stroke={INTERCONNECTOR_COLORS[iid]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Constraint congestion rent (top 8) */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Top 8 Constraints — Total Congestion Rent ($M)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chart3Data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <YAxis
              type="category"
              dataKey="constraint_id"
              width={130}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`]}
            />
            <Bar
              dataKey="total_congestion_rent_m"
              name="Congestion Rent"
              fill="#6366f1"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Stacked bar — distribution shares by year-quarter */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Congestion Rent Distribution by Quarter ($M)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart4Data} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="period"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="TNSP" stackId="b" fill="#6366f1" name="TNSP" />
            <Bar dataKey="Market Participant" stackId="b" fill="#f59e0b" name="Market Participant" />
            <Bar dataKey="SRA Holder" stackId="b" fill="#10b981" name="SRA Holder" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Regional basis to NSW1 — 2024 */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-200 mb-4">
          Regional Basis to NSW1 — 2024 (Monthly, $/MWh)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chart5Data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="$/MWh" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#e5e7eb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toFixed(2)} $/MWh`]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            {regions.map((reg) => (
              <Line
                key={reg}
                type="monotone"
                dataKey={reg}
                stroke={REGION_COLORS[reg]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary detail grid */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-base font-semibold text-gray-200 mb-4">Summary</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Total FY Congestion Rent
            </dt>
            <dd className="text-lg font-semibold text-white">
              ${summary.total_congestion_rent_fy_m.toFixed(1)}M
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Most Constrained
            </dt>
            <dd className="text-lg font-semibold text-white">
              {summary.most_constrained_interconnector}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Avg Bind Hours / Month
            </dt>
            <dd className="text-lg font-semibold text-white">
              {summary.avg_bind_hours_per_month.toFixed(1)} hrs
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Peak Shadow Price
            </dt>
            <dd className="text-lg font-semibold text-white">
              ${summary.peak_shadow_price.toFixed(2)}/MWh
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Interconnectors Tracked
            </dt>
            <dd className="text-lg font-semibold text-white">5</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Constraint Pairs
            </dt>
            <dd className="text-lg font-semibold text-white">10</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Regions
            </dt>
            <dd className="text-lg font-semibold text-white">5 (NSW1, QLD1, VIC1, SA1, TAS1)</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Distribution Recipients
            </dt>
            <dd className="text-lg font-semibold text-white">TNSP · Market Participant · SRA Holder</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
