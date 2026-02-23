import { useEffect, useState } from 'react'
import { Leaf } from 'lucide-react'
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
  getBiogasLandfillDashboard,
  BLGADashboard,
} from '../api/client'

const SITE_TYPE_COLORS: Record<string, string> = {
  'Landfill':              '#60a5fa',
  'Wastewater Treatment':  '#34d399',
  'Agricultural':          '#fbbf24',
  'Food Waste':            '#f472b6',
}

const SITE_COLORS = [
  '#60a5fa', '#34d399', '#a78bfa', '#fb923c',
  '#f472b6', '#fbbf24', '#38bdf8', '#4ade80',
  '#c084fc', '#f97316',
]

export default function BiogasLandfillAnalytics() {
  const [data, setData] = useState<BLGADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBiogasLandfillDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        Loading Biogas Landfill Gas Analytics...
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'Failed to load data'}
      </div>
    )
  }

  const { summary, sites, production, emission_reductions, economics, gas_quality } = data

  // ── Chart 1: Installed capacity by site coloured by site_type ────────────
  const chart1Data = [...sites]
    .sort((a, b) => b.installed_capacity_mw - a.installed_capacity_mw)
    .map(s => ({
      name: s.site_name.length > 18 ? s.site_name.slice(0, 16) + '…' : s.site_name,
      fullName: s.site_name,
      capacity: s.installed_capacity_mw,
      site_type: s.site_type,
    }))

  // ── Chart 2: Stacked revenue by site (2024) ──────────────────────────────
  const econ2024 = economics.filter(e => e.year === 2024)
  const chart2Data = sites.map(s => {
    const e = econ2024.find(ec => ec.site_id === s.site_id)
    return {
      name: s.site_name.length > 14 ? s.site_name.slice(0, 12) + '…' : s.site_name,
      electricity: e?.electricity_revenue_m ?? 0,
      lgc: e?.lgc_revenue_m ?? 0,
      carbon: e?.carbon_credit_revenue_m ?? 0,
    }
  }).sort((a, b) => (b.electricity + b.lgc + b.carbon) - (a.electricity + a.lgc + a.carbon))

  // ── Chart 3: CO2e abated by year for top 5 sites ─────────────────────────
  const siteTotals2024 = sites.map(s => ({
    site_id: s.site_id,
    site_name: s.site_name,
    total: emission_reductions
      .filter(er => er.site_id === s.site_id && er.year === 2024)
      .reduce((acc, er) => acc + er.co2e_abated_kt, 0),
  })).sort((a, b) => b.total - a.total).slice(0, 5)

  const top5SiteIds = siteTotals2024.map(s => s.site_id)
  const top5SiteNames = siteTotals2024.map(s =>
    s.site_name.length > 14 ? s.site_name.slice(0, 12) + '…' : s.site_name
  )
  const chart3Data = [2021, 2022, 2023, 2024].map(yr => {
    const row: Record<string, number | string> = { year: String(yr) }
    top5SiteIds.forEach((sid, i) => {
      const er = emission_reductions.find(e => e.site_id === sid && e.year === yr)
      row[top5SiteNames[i]] = er?.co2e_abated_kt ?? 0
    })
    return row
  })

  // ── Chart 4: Avg CH4% by site (2024) ─────────────────────────────────────
  const chart4Data = sites.map(s => {
    const q2024 = gas_quality.filter(gq => gq.site_id === s.site_id && gq.year === 2024)
    const avg = q2024.length > 0
      ? q2024.reduce((acc, gq) => acc + gq.ch4_pct, 0) / q2024.length
      : 0
    return {
      name: s.site_name.length > 14 ? s.site_name.slice(0, 12) + '…' : s.site_name,
      ch4_pct: Math.round(avg * 10) / 10,
    }
  }).sort((a, b) => b.ch4_pct - a.ch4_pct)

  // ── Chart 5: Gas captured TJ by quarter per site (2024, top 6 sites) ─────
  const top6ByCapacity = [...sites]
    .sort((a, b) => b.installed_capacity_mw - a.installed_capacity_mw)
    .slice(0, 6)
  const top6Ids = top6ByCapacity.map(s => s.site_id)
  const top6ShortNames = top6ByCapacity.map(s =>
    s.site_name.length > 14 ? s.site_name.slice(0, 12) + '…' : s.site_name
  )
  const chart5Data = [1, 2, 3, 4].map(q => {
    const row: Record<string, number | string> = { quarter: `Q${q} 2024` }
    top6Ids.forEach((sid, i) => {
      const p = production.find(pr => pr.site_id === sid && pr.year === 2024 && pr.quarter === q)
      row[top6ShortNames[i]] = p?.gas_captured_tj ?? 0
    })
    return row
  })

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Leaf className="text-green-500" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Biogas &amp; Landfill Gas Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Australian biogas and landfill gas generation — sites, emissions, economics &amp; gas quality
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Installed</p>
          <p className="text-2xl font-bold text-blue-500">{summary.total_installed_mw.toFixed(1)}</p>
          <p className="text-xs text-gray-400">MW</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Generation FY</p>
          <p className="text-2xl font-bold text-green-500">{summary.total_generation_gwh_fy.toFixed(1)}</p>
          <p className="text-xs text-gray-400">GWh (2024)</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">CO2e Abated FY</p>
          <p className="text-2xl font-bold text-emerald-500">{summary.total_co2e_abated_kt_fy.toFixed(1)}</p>
          <p className="text-xs text-gray-400">kt CO2e (2024)</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total LGCs FY</p>
          <p className="text-2xl font-bold text-amber-500">{summary.total_lgcs_fy.toLocaleString()}</p>
          <p className="text-xs text-gray-400">LGCs (2024)</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Capture Efficiency</p>
          <p className="text-2xl font-bold text-purple-500">{summary.avg_capture_efficiency_pct.toFixed(1)}</p>
          <p className="text-xs text-gray-400">% (2024)</p>
        </div>
      </div>

      {/* Chart 1: Installed Capacity by Site */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">Installed Capacity by Site (MW)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart1Data} margin={{ top: 4, right: 16, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" MW" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(value: number, _name: string, props: { payload?: { fullName?: string; site_type?: string } }) => [
                `${value} MW`,
                props.payload?.site_type ?? 'Capacity',
              ]}
              labelFormatter={(_label: string, payload?: Array<{ payload?: { fullName?: string } }>) =>
                payload?.[0]?.payload?.fullName ?? _label
              }
            />
            <Bar dataKey="capacity" radius={[4, 4, 0, 0]}>
              {chart1Data.map((entry, index) => (
                <Cell key={index} fill={SITE_TYPE_COLORS[entry.site_type] ?? '#60a5fa'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-2">
          {Object.entries(SITE_TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Stacked Revenue by Site (2024) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">Revenue Stack by Site — 2024 ($M)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart2Data} margin={{ top: 4, right: 16, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="electricity" name="Electricity Revenue" stackId="rev" fill="#60a5fa" radius={[0, 0, 0, 0]} />
            <Bar dataKey="lgc" name="LGC Revenue" stackId="rev" fill="#34d399" radius={[0, 0, 0, 0]} />
            <Bar dataKey="carbon" name="Carbon Credit Revenue" stackId="rev" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: CO2e Abated by Year — Top 5 Sites */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">CO2e Abated by Year — Top 5 Sites (kt CO2e)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart3Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" kt" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {top5SiteNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={SITE_COLORS[i % SITE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Avg CH4% by Site (2024) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">Average Methane Concentration by Site — 2024 (%)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chart4Data} margin={{ top: 4, right: 16, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" domain={[0, 70]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, 'Avg CH4']}
            />
            <Bar dataKey="ch4_pct" name="Avg CH4 %" fill="#34d399" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Gas Captured TJ by Quarter (2024) — Top 6 Sites */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">Gas Captured by Quarter — 2024 (TJ) — Top 6 Sites</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart5Data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit=" TJ" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {top6ShortNames.map((name, i) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="gas"
                fill={SITE_COLORS[i % SITE_COLORS.length]}
                radius={i === top6ShortNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold mb-4">Summary — FY2024</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Installed Capacity</dt>
            <dd className="text-lg font-bold text-blue-400">{summary.total_installed_mw.toFixed(1)} MW</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Total Generation</dt>
            <dd className="text-lg font-bold text-green-400">{summary.total_generation_gwh_fy.toFixed(1)} GWh</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">CO2e Abated</dt>
            <dd className="text-lg font-bold text-emerald-400">{summary.total_co2e_abated_kt_fy.toFixed(1)} kt</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">LGCs Created</dt>
            <dd className="text-lg font-bold text-amber-400">{summary.total_lgcs_fy.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Avg Capture Efficiency</dt>
            <dd className="text-lg font-bold text-purple-400">{summary.avg_capture_efficiency_pct.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Number of Sites</dt>
            <dd className="text-lg font-bold text-gray-200">{sites.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">LGC Accredited Sites</dt>
            <dd className="text-lg font-bold text-gray-200">{sites.filter(s => s.lgc_accredited).length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Landfill Sites</dt>
            <dd className="text-lg font-bold text-gray-200">{sites.filter(s => s.site_type === 'Landfill').length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">WWTP Sites</dt>
            <dd className="text-lg font-bold text-gray-200">{sites.filter(s => s.site_type === 'Wastewater Treatment').length}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Agricultural Sites</dt>
            <dd className="text-lg font-bold text-gray-200">{sites.filter(s => s.site_type === 'Agricultural').length}</dd>
          </div>
        </dl>
      </div>

    </div>
  )
}
