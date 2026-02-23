import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Layers } from 'lucide-react'
import {
  getCoalMineEnergyDashboard,
  ACMEDashboard,
} from '../api/client'

// ── Colour helpers ────────────────────────────────────────────────────────────
const MINE_TYPE_COLOURS: Record<string, string> = {
  'Open Cut':    '#f59e0b',
  'Underground': '#3b82f6',
  'Both':        '#10b981',
}

const RENEW_STATUS_COLOURS: Record<string, string> = {
  'Operating':        '#10b981',
  'Installed':        '#3b82f6',
  'Planned':          '#f59e0b',
  'Under Assessment': '#8b5cf6',
}

const TRANSITION_STATUS_COLOURS: Record<string, string> = {
  'Active':    '#f59e0b',
  'Scheduled': '#3b82f6',
  'Deferred':  '#8b5cf6',
  'Completed': '#10b981',
}

const TOP5_COLOURS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444']

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs text-gray-400 truncate">{label}</span>
      <span className="text-2xl font-bold text-white leading-none">
        {value}
        {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </span>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CoalMineEnergyAnalytics() {
  const [data, setData] = useState<ACMEDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCoalMineEnergyDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Coal Mine Energy Analytics…
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        Error loading data{error ? `: ${error}` : ''}
      </div>
    )

  const { mines, energy_profiles, emissions, renewables, transition, summary } = data

  // ── Chart 1: Mine electricity consumption coloured by mine_type ─────────────
  const mineElecData = mines.map(m => ({
    name: m.mine_name.replace(' Coal Mine', '').replace(' Mine', '').replace(' Underground', ''),
    electricity_gwh: m.electricity_consumption_gwh,
    mine_type: m.mine_type,
  }))

  // ── Chart 2: Energy cost monthly trend for top 5 mines by total energy ──────
  const top5MineIds = [...mines]
    .sort((a, b) => b.energy_consumption_pj - a.energy_consumption_pj)
    .slice(0, 5)
    .map(m => m.mine_id)

  const top5Names: Record<string, string> = {}
  mines.forEach(m => {
    if (top5MineIds.includes(m.mine_id)) {
      top5Names[m.mine_id] = m.mine_name.replace(' Coal Mine', '').replace(' Mine', '').replace(' Underground', '').slice(0, 12)
    }
  })

  const trendKeyMap: Record<string, string> = {}
  top5MineIds.forEach(id => { trendKeyMap[id] = top5Names[id] ?? id })

  const trendByPeriod: Record<string, Record<string, number>> = {}
  energy_profiles
    .filter(ep => top5MineIds.includes(ep.mine_id))
    .forEach(ep => {
      const key = `${ep.year}-Q${Math.ceil(ep.month / 3)}`
      if (!trendByPeriod[key]) trendByPeriod[key] = { period: key as unknown as number }
      trendByPeriod[key][trendKeyMap[ep.mine_id]] = ep.energy_cost_m_aud
    })
  const trendData = Object.values(trendByPeriod).sort((a, b) =>
    String(a.period).localeCompare(String(b.period))
  )

  // ── Chart 3: Scope1 vs Scope2 emissions grouped bar for 2024 ────────────────
  const emissions2024 = emissions.filter(e => e.year === 2024)
  const emissionsBarData = emissions2024.map(e => {
    const mine = mines.find(m => m.mine_id === e.mine_id)
    return {
      name: (mine?.mine_name ?? e.mine_id).replace(' Coal Mine', '').replace(' Mine', '').replace(' Underground', '').slice(0, 12),
      scope1: e.scope1_co2e_kt,
      scope2: e.scope2_co2e_kt,
    }
  })

  // ── Chart 4: Renewable technology installed capacity coloured by status ──────
  const renewBarData = renewables.map((r, idx) => ({
    name: `${r.technology.slice(0, 10)} #${idx + 1}`,
    capacity_mw: r.installed_capacity_mw,
    status: r.status,
  }))

  // ── Chart 5: Transition closure year timeline with rehab cost ────────────────
  const transBarData = transition.map(t => {
    const mine = mines.find(m => m.mine_id === t.mine_id)
    return {
      name: (mine?.mine_name ?? t.mine_id).replace(' Coal Mine', '').replace(' Mine', '').slice(0, 12),
      rehab_cost: t.rehabilitation_cost_m_aud,
      closure_year: t.closure_year,
      transition_status: t.transition_status,
    }
  }).sort((a, b) => a.closure_year - b.closure_year)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Layers size={24} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Australian Coal Mine Energy Analytics
          </h1>
          <p className="text-sm text-gray-400">
            ACME — Energy consumption, emissions &amp; transition across Australian coal mines
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total Mines" value={String(summary.total_mines)} />
        <KpiCard
          label="Total Energy Consumption"
          value={summary.total_energy_consumption_pj.toFixed(1)}
          unit="PJ"
        />
        <KpiCard
          label="Avg Renewable Fraction"
          value={summary.avg_renewable_fraction_pct.toFixed(1)}
          unit="%"
        />
        <KpiCard
          label="Total Scope 1 Emissions"
          value={summary.total_scope1_emissions_mt.toFixed(3)}
          unit="Mt CO₂e"
        />
      </div>

      {/* Chart 1: Mine Electricity Consumption by Mine Type */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Mine Electricity Consumption (GWh) — coloured by Mine Type
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={mineElecData} margin={{ top: 4, right: 16, bottom: 60, left: 0 }}>
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
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toFixed(1)} GWh`, 'Electricity']}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(v) => <span style={{ color: '#d1d5db', fontSize: 11 }}>{v}</span>}
            />
            {Object.entries(MINE_TYPE_COLOURS).map(([mineType, colour]) => (
              <Bar
                key={mineType}
                dataKey="electricity_gwh"
                name={mineType}
                fill={colour}
                data={mineElecData.filter(d => d.mine_type === mineType)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Energy Cost Monthly Trend */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Energy Cost Trend (M AUD) — Top 5 Mines by Total Energy (2022–2024)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData} margin={{ top: 4, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`$${v.toFixed(2)}M`, 'Energy Cost']}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(v) => <span style={{ color: '#d1d5db', fontSize: 11 }}>{v}</span>}
            />
            {Object.values(trendKeyMap).map((mineName, idx) => (
              <Line
                key={mineName}
                type="monotone"
                dataKey={mineName}
                stroke={TOP5_COLOURS[idx % TOP5_COLOURS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Scope 1 vs Scope 2 Emissions Grouped Bar (2024) */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Scope 1 vs Scope 2 Emissions (kt CO₂e) — 2024
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={emissionsBarData} margin={{ top: 4, right: 16, bottom: 60, left: 0 }}>
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
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toFixed(1)} kt CO₂e`]}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(v) => <span style={{ color: '#d1d5db', fontSize: 11 }}>{v}</span>}
            />
            <Bar dataKey="scope1" name="Scope 1" fill="#ef4444" />
            <Bar dataKey="scope2" name="Scope 2" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Renewable Technology Installed Capacity */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Renewable Technology Installed Capacity (MW) — coloured by Status
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={renewBarData} margin={{ top: 4, right: 16, bottom: 60, left: 0 }}>
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
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number) => [`${v.toFixed(1)} MW`, 'Installed Capacity']}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(v) => <span style={{ color: '#d1d5db', fontSize: 11 }}>{v}</span>}
            />
            {Object.entries(RENEW_STATUS_COLOURS).map(([status, colour]) => (
              <Bar
                key={status}
                dataKey="capacity_mw"
                name={status}
                fill={colour}
                data={renewBarData.filter(d => d.status === status)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Transition Closure Year Timeline */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">
          Transition Closure Year Timeline — Rehabilitation Cost (M AUD) by Status
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={transBarData} margin={{ top: 4, right: 16, bottom: 60, left: 0 }}>
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
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f3f4f6' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(v: number, _name: string, props: { payload?: { closure_year?: number; transition_status?: string } }) => [
                `$${v.toFixed(1)}M (${props?.payload?.closure_year ?? ''})`,
                props?.payload?.transition_status ?? 'Rehab Cost',
              ]}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(v) => <span style={{ color: '#d1d5db', fontSize: 11 }}>{v}</span>}
            />
            {Object.entries(TRANSITION_STATUS_COLOURS).map(([status, colour]) => (
              <Bar
                key={status}
                dataKey="rehab_cost"
                name={status}
                fill={colour}
                data={transBarData.filter(d => d.transition_status === status)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total Onsite Renewables"
          value={summary.total_onsite_renewables_mw.toFixed(1)}
          unit="MW"
        />
        <KpiCard
          label="Mines Above Safeguard Threshold"
          value={String(summary.mines_above_safeguard_threshold)}
        />
        <KpiCard
          label="Total Transition Support"
          value={`$${summary.total_transition_support_m_aud.toFixed(1)}`}
          unit="M AUD"
        />
      </div>
    </div>
  )
}
