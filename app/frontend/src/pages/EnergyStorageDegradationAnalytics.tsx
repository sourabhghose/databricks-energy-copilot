import { useEffect, useState } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Battery, Activity, AlertTriangle, Zap } from 'lucide-react'
import {
  getBESSDegradationDashboard,
  BDGDashboard,
  BDGAssetRecord,
  BDGHealthIndicatorRecord,
  BDGMaintenanceRecord,
} from '../api/client'

// ─── Colour maps ──────────────────────────────────────────────────────────────
const TECH_COLOURS: Record<string, string> = {
  LFP:  'bg-emerald-700',
  NMC:  'bg-blue-700',
  NCA:  'bg-violet-700',
  LTO:  'bg-cyan-700',
  VRFB: 'bg-amber-700',
  ZNBR: 'bg-rose-700',
}

const MAINT_COLOURS: Record<string, string> = {
  PREVENTIVE:  'bg-blue-700',
  CORRECTIVE:  'bg-red-700',
  PREDICTIVE:  'bg-amber-700',
  REPLACEMENT: 'bg-purple-700',
}

const CHART_LINE_COLOURS: Record<string, string> = {
  LFP:  '#4ade80',
  NMC:  '#60a5fa',
  NCA:  '#a78bfa',
  LTO:  '#22d3ee',
  VRFB: '#fbbf24',
  ZNBR: '#f87171',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon, accent = 'text-cyan-400' }: {
  label: string; value: string; sub?: string; Icon: React.ElementType; accent?: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
      <div className="p-3 bg-gray-700 rounded-lg">
        <Icon className={`w-6 h-6 ${accent}`} />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, colourClass }: { label: string; colourClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold text-white ${colourClass}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

// ─── SoH Progress Bar ─────────────────────────────────────────────────────────
function SohBar({ value }: { value: number }) {
  const colour =
    value >= 90 ? 'bg-green-500' :
    value >= 80 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className={`${colour} h-2 rounded-full`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-12 text-right">{value.toFixed(1)}%</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EnergyStorageDegradationAnalytics() {
  const [data, setData] = useState<BDGDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBESSDegradationDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <p className="text-gray-400 animate-pulse">Loading BESS Degradation Analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <p className="text-red-400">Error: {error ?? 'No data'}</p>
      </div>
    )
  }

  const summary = data.summary as Record<string, number | string>

  // ── Degradation curve data: LFP vs NMC at 80% DoD ─────────────────────────
  const degCurveData = Array.from({ length: 16 }, (_, yr) => {
    const row: Record<string, number> = { year: yr }
    for (const tech of ['LFP', 'NMC']) {
      const rec = data.degradation_curves.find(
        d => d.technology === tech && d.year === yr && d.dod_pct === 70
      ) ?? data.degradation_curves.find(
        d => d.technology === tech && d.year === yr
      )
      if (rec) row[tech] = rec.capacity_retention_pct
    }
    return row
  })

  // ── LCOE bar chart: MODERATE scenario latest year per tech ─────────────────
  const lcoeData = (['LFP', 'NMC', 'NCA', 'LTO', 'VRFB', 'ZNBR'] as const).map(tech => {
    const recs = data.lifecycle_economics.filter(r => r.technology === tech && r.scenario === 'MODERATE')
    const latest = recs.sort((a, b) => a.year - b.year)[0]
    return { technology: tech, lcoe: latest?.lcoe_aud_per_mwh ?? 0 }
  })

  // ── Latest health indicator per asset ──────────────────────────────────────
  const latestHealth = new Map<string, BDGHealthIndicatorRecord>()
  for (const h of data.health_indicators) {
    const existing = latestHealth.get(h.asset_id)
    if (!existing || h.timestamp > existing.timestamp) {
      latestHealth.set(h.asset_id, h)
    }
  }
  const healthRows = Array.from(latestHealth.values())

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gray-800 rounded-xl">
          <Battery className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">BESS Degradation Analytics</h1>
          <p className="text-sm text-gray-400">Battery energy storage lifetime, health and lifecycle economics — Australian NEM</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Assets"
          value={String(summary.total_assets ?? data.assets.length)}
          sub="Tracked BESS fleet"
          Icon={Battery}
          accent="text-emerald-400"
        />
        <KpiCard
          label="Avg State of Health"
          value={`${summary.avg_soh_pct ?? '—'}%`}
          sub="Fleet-wide SoH"
          Icon={Activity}
          accent="text-cyan-400"
        />
        <KpiCard
          label="Total Current Capacity"
          value={`${Number(summary.total_current_mwh ?? 0).toLocaleString()} MWh`}
          sub={`of ${Number(summary.total_nameplate_mwh ?? 0).toLocaleString()} MWh nameplate`}
          Icon={Zap}
          accent="text-amber-400"
        />
        <KpiCard
          label="Assets Below 80% SoH"
          value={String(summary.assets_below_80_soh ?? '—')}
          sub="Approaching end-of-life"
          Icon={AlertTriangle}
          accent="text-red-400"
        />
      </div>

      {/* Asset Fleet Table */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Asset Fleet Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Asset</th>
                <th className="text-left pb-2 pr-4">Technology</th>
                <th className="text-left pb-2 pr-4">Region</th>
                <th className="text-left pb-2 pr-4">State of Health</th>
                <th className="text-right pb-2 pr-4">Age (yr)</th>
                <th className="text-right pb-2 pr-4">Cycles</th>
                <th className="text-right pb-2">EoL Year</th>
              </tr>
            </thead>
            <tbody>
              {data.assets.map((a: BDGAssetRecord) => (
                <tr key={a.asset_id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4">
                    <p className="text-white font-medium">{a.name}</p>
                    <p className="text-xs text-gray-500">{a.asset_id}</p>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={a.technology} colourClass={TECH_COLOURS[a.technology] ?? 'bg-gray-600'} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{a.region}</td>
                  <td className="py-2 pr-4 w-40">
                    <SohBar value={a.soh_pct} />
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">{a.age_years.toFixed(1)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{a.cycles_completed.toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-300">{a.expected_eol_year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Degradation Curves */}
        <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-1">Capacity Degradation Curves</h2>
          <p className="text-xs text-gray-400 mb-4">LFP vs NMC — capacity retention % over years (~70% DoD)</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={degCurveData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 11 }} label={{ value: 'Year', position: 'insideBottomRight', offset: -5, fill: '#9ca3af', fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[70, 100]} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#d1d5db' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`]}
                labelFormatter={l => `Year ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Line type="monotone" dataKey="LFP" stroke={CHART_LINE_COLOURS.LFP} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="NMC" stroke={CHART_LINE_COLOURS.NMC} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Lifecycle Cost (LCOE) */}
        <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-1">Lifecycle Cost (LCOE)</h2>
          <p className="text-xs text-gray-400 mb-4">AUD/MWh by technology — MODERATE scenario, near-term</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={lcoeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="technology" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} unit=" $/MWh" width={75} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#d1d5db' }}
                itemStyle={{ color: '#e5e7eb' }}
                formatter={(v: number) => [`$${v.toFixed(1)}/MWh`]}
              />
              <Bar dataKey="lcoe" name="LCOE (AUD/MWh)" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* Health Indicators Table */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Battery Health Indicators (Latest per Asset)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Asset ID</th>
                <th className="text-right pb-2 pr-4">Int. Resistance (mΩ)</th>
                <th className="text-right pb-2 pr-4">Self-Discharge (%/day)</th>
                <th className="text-right pb-2 pr-4">Cap. Fade %</th>
                <th className="text-right pb-2 pr-4">Voltage Dev. (mV)</th>
                <th className="text-right pb-2 pr-4">SoH %</th>
                <th className="text-right pb-2 pr-4">RUL (cycles)</th>
                <th className="text-center pb-2">Thermal</th>
              </tr>
            </thead>
            <tbody>
              {healthRows.map((h: BDGHealthIndicatorRecord) => (
                <tr
                  key={h.asset_id}
                  className={`border-b border-gray-700 ${h.thermal_anomaly ? 'bg-red-900/20' : 'hover:bg-gray-750'}`}
                >
                  <td className="py-2 pr-4 text-white font-medium">{h.asset_id}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{h.internal_resistance_mohm.toFixed(3)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{h.self_discharge_pct_per_day.toFixed(4)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{h.capacity_fade_pct.toFixed(2)}%</td>
                  <td className={`py-2 pr-4 text-right ${Math.abs(h.voltage_deviation_mv) > 30 ? 'text-amber-400' : 'text-gray-300'}`}>
                    {h.voltage_deviation_mv > 0 ? '+' : ''}{h.voltage_deviation_mv.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <span className={h.soh_pct >= 90 ? 'text-green-400' : h.soh_pct >= 80 ? 'text-yellow-400' : 'text-red-400'}>
                      {h.soh_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">{h.predicted_rul_cycles.toLocaleString()}</td>
                  <td className="py-2 text-center">
                    {h.thermal_anomaly
                      ? <span className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold"><AlertTriangle className="w-3 h-3" /> ALERT</span>
                      : <span className="text-green-500 text-xs">OK</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Maintenance Records Table */}
      <section className="bg-gray-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4">Maintenance Records</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Asset</th>
                <th className="text-left pb-2 pr-4">Type</th>
                <th className="text-left pb-2 pr-4">Date</th>
                <th className="text-right pb-2 pr-4">Cost (AUD k)</th>
                <th className="text-right pb-2 pr-4">Capacity Restored (MWh)</th>
                <th className="text-right pb-2 pr-4">Downtime (h)</th>
                <th className="text-left pb-2">Root Cause</th>
              </tr>
            </thead>
            <tbody>
              {data.maintenance_records.map((m: BDGMaintenanceRecord, idx: number) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="py-2 pr-4 text-gray-300">{m.asset_id}</td>
                  <td className="py-2 pr-4">
                    <Badge label={m.maintenance_type} colourClass={MAINT_COLOURS[m.maintenance_type] ?? 'bg-gray-600'} />
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{m.date}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">${m.cost_aud_k.toFixed(1)}k</td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {m.capacity_restored_mwh > 0 ? `${m.capacity_restored_mwh.toFixed(1)} MWh` : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">{m.downtime_hours.toFixed(1)}</td>
                  <td className="py-2 text-gray-400 text-xs">{m.root_cause ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
