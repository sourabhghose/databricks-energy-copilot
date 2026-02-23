import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Flame } from 'lucide-react'
import {
  getCoalSeamGasDashboard,
  CSGADashboard,
} from '../api/client'

// ── Colour helpers ────────────────────────────────────────────────────────────
const OPERATOR_COLOURS: Record<string, string> = {
  'Santos':          '#f59e0b',
  'Shell QGC':       '#3b82f6',
  'Origin Energy':   '#10b981',
  'Arrow Energy':    '#8b5cf6',
  'ConocoPhillips':  '#ef4444',
}

const TERMINAL_COLOURS: Record<string, string> = {
  'QCLNG':     '#f59e0b',
  'APLNG':     '#3b82f6',
  'GLNG':      '#10b981',
  'Arrow LNG': '#8b5cf6',
}

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
export default function CoalSeamGasAnalytics() {
  const [data, setData] = useState<CSGADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCoalSeamGasDashboard()
      .then(setData)
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Coal Seam Gas Analytics…
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data available'}
      </div>
    )

  const { fields, production_trends, exports, water_management, infrastructure, summary } = data

  // ── Chart 1 data: reserves by field ────────────────────────────────────────
  const reservesData = fields.map((f) => ({
    name: f.field_name.replace(' Basin', '').replace(' CSG', ''),
    reserves: f.proven_reserves_pj,
    operator: f.operator,
    fill: OPERATOR_COLOURS[f.operator] ?? '#6b7280',
  }))

  // ── Chart 2 data: quarterly production summed across all fields ─────────────
  const quarterlyMap: Record<string, number> = {}
  production_trends.forEach((pt) => {
    const key = `${pt.year} Q${pt.quarter}`
    quarterlyMap[key] = (quarterlyMap[key] ?? 0) + pt.production_pj
  })
  const quarterlyData = Object.entries(quarterlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, production_pj]) => ({ period, production_pj: +production_pj.toFixed(2) }))

  // ── Chart 3 data: LNG exports vs domestic supply by terminal × year ─────────
  const chart3Map: Record<string, { terminal: string; year: number; lng: number; domestic10: number }> = {}
  exports.forEach((e) => {
    const key = `${e.terminal}-${e.year}`
    if (!chart3Map[key]) chart3Map[key] = { terminal: e.terminal, year: e.year, lng: 0, domestic10: 0 }
    chart3Map[key].lng += e.lng_exports_mt
    chart3Map[key].domestic10 += e.domestic_supply_pj / 10
  })
  const chart3Data = Object.values(chart3Map)
    .sort((a, b) => a.year - b.year || a.terminal.localeCompare(b.terminal))
    .map((r) => ({
      label: `${r.terminal} ${r.year}`,
      lng_exports_mt: +r.lng.toFixed(2),
      domestic_supply_pj10: +r.domestic10.toFixed(1),
    }))

  // ── Chart 4 data: water management for top-6 fields by produced volume ───────
  const waterByField: Record<string, { produced: number; treated: number; beneficial: number }> = {}
  water_management.forEach((w) => {
    if (!waterByField[w.field_id]) waterByField[w.field_id] = { produced: 0, treated: 0, beneficial: 0 }
    waterByField[w.field_id].produced += w.produced_water_ml
    waterByField[w.field_id].treated += w.treated_water_ml
    waterByField[w.field_id].beneficial += w.beneficial_use_ml
  })
  const fieldNameMap = Object.fromEntries(fields.map((f) => [f.field_id, f.field_name]))
  const waterData = Object.entries(waterByField)
    .sort((a, b) => b[1].produced - a[1].produced)
    .slice(0, 6)
    .map(([fid, v]) => ({
      name: (fieldNameMap[fid] ?? fid).replace(' Basin', '').replace(' CSG', ''),
      produced: +v.produced.toFixed(0),
      treated: +v.treated.toFixed(0),
      beneficial: +v.beneficial.toFixed(0),
    }))

  // ── Chart 5 data: infrastructure utilisation ─────────────────────────────────
  const infraData = infrastructure.map((i) => ({
    name: i.asset_name.length > 22 ? i.asset_name.slice(0, 20) + '…' : i.asset_name,
    utilisation_pct: i.utilisation_pct,
    type: i.asset_type,
  }))

  return (
    <div className="p-6 space-y-8 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Flame className="text-amber-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">Coal Seam Gas Analytics</h1>
          <p className="text-sm text-gray-400">
            Australian CSG fields, production trends, LNG exports and water management
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Reserves" value={summary.total_reserves_pj.toLocaleString()} unit="PJ" />
        <KpiCard label="Total Production" value={summary.total_production_tj_day.toFixed(1)} unit="TJ/day" />
        <KpiCard label="FY24 LNG Exports" value={summary.total_exports_mt_fy.toFixed(2)} unit="Mt" />
        <KpiCard label="Avg Domestic Price" value={`$${summary.avg_domestic_price_aud_gj.toFixed(2)}`} unit="/GJ" />
        <KpiCard label="Total Wells" value={summary.total_wells.toLocaleString()} />
      </div>

      {/* Chart 1 — Proven reserves by field */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-white">Proven Reserves by Field (PJ)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={reservesData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" PJ" />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }}
              formatter={(v: number) => [`${v.toLocaleString()} PJ`, 'Reserves']}
            />
            <Bar dataKey="reserves" name="Proven Reserves">
              {reservesData.map((entry, i) => (
                <rect key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* operator legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(OPERATOR_COLOURS).map(([op, colour]) => (
            <span key={op} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: colour }} />
              {op}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2 — Quarterly production trend */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-white">Total Quarterly Production — All Fields (PJ)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={quarterlyData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" interval={1} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" PJ" />
            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }}
              formatter={(v: number) => [`${v} PJ`, 'Production']} />
            <Line type="monotone" dataKey="production_pj" name="Production (PJ)" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3 — LNG exports vs domestic supply by terminal × year */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-white">LNG Exports (Mt) vs Domestic Supply ÷10 (PJ) by Terminal & Year</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart3Data} margin={{ top: 4, right: 16, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="lng_exports_mt" name="LNG Exports (Mt)" fill="#f59e0b" />
            <Bar dataKey="domestic_supply_pj10" name="Domestic Supply ÷10 (PJ)" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4 — Water management stacked bar (top 6 fields) */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-white">Cumulative Water Management — Top 6 Fields (ML)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={waterData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" ML" />
            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }}
              formatter={(v: number) => [`${v.toLocaleString()} ML`]} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="produced" name="Produced (ML)" stackId="a" fill="#ef4444" />
            <Bar dataKey="treated" name="Treated (ML)" stackId="a" fill="#3b82f6" />
            <Bar dataKey="beneficial" name="Beneficial Use (ML)" stackId="a" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5 — Infrastructure utilisation */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-white">Infrastructure Utilisation (%)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={infraData} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
            <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={180} />
            <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#f3f4f6' }}
              formatter={(v: number) => [`${v}%`, 'Utilisation']} />
            <Bar dataKey="utilisation_pct" name="Utilisation (%)" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary details grid */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-white">Field Summary</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
          {fields.map((f) => (
            <div key={f.field_id} className="border-b border-gray-700 pb-2">
              <dt className="text-xs font-medium text-amber-400 truncate">{f.field_name}</dt>
              <dd className="mt-0.5 text-sm text-gray-300 space-y-0.5">
                <span className="block">Operator: {f.operator} · {f.state}</span>
                <span className="block">
                  Reserves: {f.proven_reserves_pj.toLocaleString()} PJ &nbsp;|&nbsp;
                  Rate: {f.production_rate_tj_day} TJ/day
                </span>
                <span className="block">
                  Wells: {f.well_count.toLocaleString()} &nbsp;|&nbsp;
                  Water: {f.water_production_ml_day} ML/day
                </span>
                <span className="block text-gray-500 text-xs">
                  First production: {f.first_production_year}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Infrastructure table */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-4 text-white">Infrastructure Assets</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="pb-2 pr-4 font-medium">Asset</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Capacity</th>
                <th className="pb-2 pr-4 font-medium">Utilisation</th>
                <th className="pb-2 font-medium">CapEx (A$M)</th>
              </tr>
            </thead>
            <tbody>
              {infrastructure.map((i, idx) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-white">{i.asset_name}</td>
                  <td className="py-2 pr-4 text-gray-300">{i.asset_type}</td>
                  <td className="py-2 pr-4 text-gray-300">{i.capacity} {i.capacity_unit}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        i.utilisation_pct >= 90
                          ? 'text-amber-400'
                          : i.utilisation_pct >= 75
                          ? 'text-green-400'
                          : 'text-blue-400'
                      }
                    >
                      {i.utilisation_pct}%
                    </span>
                  </td>
                  <td className="py-2 text-gray-300">{i.capex_m_aud.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
