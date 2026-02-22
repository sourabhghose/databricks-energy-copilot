import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ShieldCheck, Activity, Clock, AlertTriangle } from 'lucide-react'
import {
  ENPADashboard,
  ENPARelayRecord,
  ENPAFaultRecord,
  getNetworkProtectionSystemDashboard,
} from '../api/client'

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, Icon, colour,
}: {
  label: string
  value: string
  sub?: string
  Icon: React.ElementType
  colour: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow">
      <div className={`p-3 rounded-lg ${colour}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Condition badge ───────────────────────────────────────────────────────────
function ConditionBadge({ condition }: { condition: string }) {
  const colours: Record<string, string> = {
    Good: 'bg-green-700 text-green-100',
    Fair: 'bg-yellow-700 text-yellow-100',
    Poor: 'bg-orange-700 text-orange-100',
    Critical: 'bg-red-700 text-red-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colours[condition] ?? 'bg-gray-700 text-gray-100'}`}>
      {condition}
    </span>
  )
}

// ── Test result badge ─────────────────────────────────────────────────────────
function TestBadge({ result }: { result: string }) {
  const colours: Record<string, string> = {
    Pass: 'bg-green-700 text-green-100',
    Fail: 'bg-red-700 text-red-100',
    Conditional: 'bg-yellow-700 text-yellow-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colours[result] ?? 'bg-gray-700 text-gray-100'}`}>
      {result}
    </span>
  )
}

// ── Correct operation badge ───────────────────────────────────────────────────
function OpBadge({ correct }: { correct: boolean }) {
  return correct
    ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-700 text-green-100">Correct</span>
    : <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-700 text-red-100">Incorrect</span>
}

// ── Relay condition distribution by type ─────────────────────────────────────
function buildConditionByType(relays: ENPARelayRecord[]) {
  const map: Record<string, Record<string, number>> = {}
  for (const r of relays) {
    if (!map[r.relay_type]) map[r.relay_type] = { Good: 0, Fair: 0, Poor: 0, Critical: 0 }
    map[r.relay_type][r.condition] = (map[r.relay_type][r.condition] ?? 0) + 1
  }
  return Object.entries(map).map(([type, counts]) => ({ type: type.replace(' ', '\n'), ...counts }))
}

// ── Fault clearing time histogram ────────────────────────────────────────────
function buildClearingHistogram(faults: ENPAFaultRecord[]) {
  const bins = [
    { name: '<80ms', count: 0 },
    { name: '80–100ms', count: 0 },
    { name: '100–150ms', count: 0 },
    { name: '>150ms', count: 0 },
  ]
  for (const f of faults) {
    if (f.clearing_time_ms < 80) bins[0].count++
    else if (f.clearing_time_ms < 100) bins[1].count++
    else if (f.clearing_time_ms < 150) bins[2].count++
    else bins[3].count++
  }
  return bins
}

// ── Performance trend by region ───────────────────────────────────────────────
function buildPerfTrend(performance: ENPADashboard['performance']) {
  const quarters = [1, 2, 3, 4]
  const regions = [...new Set(performance.map(p => p.region))].sort()
  return quarters.map(q => {
    const row: Record<string, string | number> = { quarter: `Q${q}` }
    for (const region of regions) {
      const rec = performance.find(p => p.quarter === q && p.region === region)
      row[region] = rec ? rec.correct_operation_pct : 0
    }
    return row
  })
}

// ── Fault types + correct vs incorrect ───────────────────────────────────────
function buildFaultTypeOps(faults: ENPAFaultRecord[]) {
  const map: Record<string, { correct: number; incorrect: number }> = {}
  for (const f of faults) {
    if (!map[f.fault_type]) map[f.fault_type] = { correct: 0, incorrect: 0 }
    if (f.correct_operation) map[f.fault_type].correct++
    else map[f.fault_type].incorrect++
  }
  return Object.entries(map).map(([type, counts]) => ({ type, ...counts }))
}

const REGION_COLOURS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  QLD: '#f59e0b',
  SA:  '#a78bfa',
  TAS: '#fb7185',
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NetworkProtectionSystemAnalytics() {
  const [data, setData] = useState<ENPADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNetworkProtectionSystemDashboard()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load data'))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/40 text-red-300 rounded-xl p-6 text-sm">
          Error: {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading protection system data…</div>
      </div>
    )
  }

  const { relays, faults, coordination, performance, settings, maintenance, summary } = data

  const conditionByType = buildConditionByType(relays)
  const clearingHistogram = buildClearingHistogram(faults)
  const perfTrend = buildPerfTrend(performance)
  const faultTypeOps = buildFaultTypeOps(faults)
  const perfRegions = [...new Set(performance.map(p => p.region))].sort()

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-700 rounded-lg">
          <ShieldCheck size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Electricity Network Protection System Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            NEM relay inventory · fault analysis · coordination · performance · settings · maintenance
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Relays"
          value={String(summary.total_relays)}
          sub="Across all NEM regions"
          Icon={ShieldCheck}
          colour="bg-cyan-700"
        />
        <KpiCard
          label="Correct Operation Rate"
          value={`${Number(summary.correct_operation_rate_pct).toFixed(1)}%`}
          sub="Protection performance 2024"
          Icon={Activity}
          colour="bg-green-700"
        />
        <KpiCard
          label="Avg Fault Clearing"
          value={`${Number(summary.avg_fault_clearing_ms).toFixed(0)} ms`}
          sub="Across recorded faults"
          Icon={Clock}
          colour="bg-blue-700"
        />
        <KpiCard
          label="Miscoordinated Zones"
          value={String(summary.miscoordinated_zones)}
          sub="Require immediate review"
          Icon={AlertTriangle}
          colour={Number(summary.miscoordinated_zones) > 0 ? 'bg-red-700' : 'bg-gray-700'}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Relay condition by type */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Relay Condition Distribution by Type
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={conditionByType} margin={{ top: 4, right: 8, bottom: 60, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#f9fafb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="Good"     stackId="a" fill="#34d399" />
              <Bar dataKey="Fair"     stackId="a" fill="#fbbf24" />
              <Bar dataKey="Poor"     stackId="a" fill="#f97316" />
              <Bar dataKey="Critical" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fault clearing time histogram */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Fault Clearing Time Distribution
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={clearingHistogram} margin={{ top: 4, right: 8, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} label={{ value: 'Faults', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#f9fafb' }} />
              <Bar dataKey="count" fill="#60a5fa" name="Fault Count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Performance trend by region */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Protection Performance Trend by Region (Correct Op % — 2024)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={perfTrend} margin={{ top: 4, right: 16, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[80, 100]} unit="%" />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#f9fafb' }} formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              {perfRegions.map(r => (
                <Line key={r} type="monotone" dataKey={r} stroke={REGION_COLOURS[r] ?? '#60a5fa'} strokeWidth={2} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Fault types: correct vs incorrect */}
        <div className="bg-gray-800 rounded-xl p-5 shadow">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">
            Fault Types — Correct vs Incorrect Protection Operation
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={faultTypeOps} margin={{ top: 4, right: 8, bottom: 60, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', color: '#f9fafb' }} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="correct"   fill="#34d399" name="Correct" radius={[4, 4, 0, 0]} />
              <Bar dataKey="incorrect" fill="#ef4444" name="Incorrect" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Relay Inventory Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Relay Inventory</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium">Relay ID</th>
                <th className="text-left py-2 pr-4 font-medium">Type</th>
                <th className="text-left py-2 pr-4 font-medium">Location</th>
                <th className="text-left py-2 pr-4 font-medium">Region</th>
                <th className="text-right py-2 pr-4 font-medium">kV</th>
                <th className="text-left py-2 pr-4 font-medium">Manufacturer</th>
                <th className="text-right py-2 pr-4 font-medium">Op Time (ms)</th>
                <th className="text-left py-2 pr-4 font-medium">Test Result</th>
                <th className="text-left py-2 pr-4 font-medium">Condition</th>
                <th className="text-right py-2 font-medium">Replace By</th>
              </tr>
            </thead>
            <tbody>
              {relays.map((r, idx) => (
                <tr key={r.relay_id} className={idx % 2 === 0 ? 'bg-gray-850' : 'bg-gray-800'}>
                  <td className="py-1.5 pr-4 font-mono text-cyan-400">{r.relay_id}</td>
                  <td className="py-1.5 pr-4">{r.relay_type}</td>
                  <td className="py-1.5 pr-4 text-gray-400 max-w-[140px] truncate">{r.location}</td>
                  <td className="py-1.5 pr-4">{r.region}</td>
                  <td className="py-1.5 pr-4 text-right">{r.voltage_level_kv}</td>
                  <td className="py-1.5 pr-4">{r.manufacturer}</td>
                  <td className="py-1.5 pr-4 text-right">{r.operating_time_ms}</td>
                  <td className="py-1.5 pr-4"><TestBadge result={r.test_result} /></td>
                  <td className="py-1.5 pr-4"><ConditionBadge condition={r.condition} /></td>
                  <td className="py-1.5 text-right text-gray-400">{r.replacement_due_year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Faults Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Recent Fault Events</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-gray-300">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4 font-medium">Fault ID</th>
                <th className="text-left py-2 pr-4 font-medium">Date</th>
                <th className="text-left py-2 pr-4 font-medium">Location</th>
                <th className="text-left py-2 pr-4 font-medium">Type</th>
                <th className="text-left py-2 pr-4 font-medium">Region</th>
                <th className="text-right py-2 pr-4 font-medium">kV</th>
                <th className="text-right py-2 pr-4 font-medium">Current (kA)</th>
                <th className="text-right py-2 pr-4 font-medium">Clear (ms)</th>
                <th className="text-left py-2 pr-4 font-medium">Operation</th>
                <th className="text-right py-2 pr-4 font-medium">Load (MW)</th>
                <th className="text-left py-2 font-medium">Restoration</th>
              </tr>
            </thead>
            <tbody>
              {faults.map((f, idx) => (
                <tr key={f.fault_id} className={idx % 2 === 0 ? 'bg-gray-850' : 'bg-gray-800'}>
                  <td className="py-1.5 pr-4 font-mono text-cyan-400">{f.fault_id}</td>
                  <td className="py-1.5 pr-4 text-gray-400">{f.fault_date}</td>
                  <td className="py-1.5 pr-4 max-w-[120px] truncate">{f.fault_location}</td>
                  <td className="py-1.5 pr-4">{f.fault_type}</td>
                  <td className="py-1.5 pr-4">{f.region}</td>
                  <td className="py-1.5 pr-4 text-right">{f.voltage_level_kv}</td>
                  <td className="py-1.5 pr-4 text-right">{f.fault_current_ka}</td>
                  <td className={`py-1.5 pr-4 text-right font-medium ${f.clearing_time_ms > 150 ? 'text-red-400' : f.clearing_time_ms > 100 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {f.clearing_time_ms}
                  </td>
                  <td className="py-1.5 pr-4"><OpBadge correct={f.correct_operation} /></td>
                  <td className="py-1.5 pr-4 text-right">{f.affected_load_mw}</td>
                  <td className="py-1.5 text-gray-400">{f.restoration_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary stats footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 text-center shadow">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Coordination Records</p>
          <p className="text-xl font-bold text-white mt-1">{coordination.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center shadow">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Setting Records</p>
          <p className="text-xl font-bold text-white mt-1">{settings.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center shadow">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Maintenance Records</p>
          <p className="text-xl font-bold text-white mt-1">{maintenance.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center shadow">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Maintenance Overdue</p>
          <p className={`text-xl font-bold mt-1 ${Number(summary.maintenance_overdue_count) > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {summary.maintenance_overdue_count}
          </p>
        </div>
      </div>

    </div>
  )
}
