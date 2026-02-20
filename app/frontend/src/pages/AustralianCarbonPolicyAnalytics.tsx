import { useEffect, useState } from 'react'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Leaf, Building2, AlertTriangle, DollarSign, TrendingDown } from 'lucide-react'
import {
  getAustralianCarbonPolicyDashboard,
  ACPDashboard,
  ACPSafeguardRecord,
  ACPCarbonPriceRecord,
  ACPACCUMarketRecord,
  ACPSectorPathwayRecord,
  ACPPolicyInstrumentRecord,
} from '../api/client'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const COMPLIANCE_COLOURS: Record<string, string> = {
  COMPLIANT:     'bg-green-700 text-green-100',
  NON_COMPLIANT: 'bg-red-700 text-red-100',
  DEFERRED:      'bg-yellow-700 text-yellow-100',
}

const STRENGTH_COLOURS: Record<string, string> = {
  WEAK:       'bg-red-800 text-red-200',
  MODERATE:   'bg-yellow-800 text-yellow-200',
  STRONG:     'bg-green-800 text-green-200',
  VERY_STRONG:'bg-emerald-700 text-emerald-100',
}

const INSTRUMENT_TYPE_COLOURS: Record<string, string> = {
  CARBON_PRICE: 'bg-blue-800 text-blue-200',
  STANDARD:     'bg-purple-800 text-purple-200',
  SUBSIDY:      'bg-teal-800 text-teal-200',
  REGULATION:   'bg-orange-800 text-orange-200',
  TARGET:       'bg-cyan-800 text-cyan-200',
}

const SCOPE_COLOURS: Record<string, string> = {
  NATIONAL: 'bg-indigo-800 text-indigo-200',
  STATE:    'bg-pink-800 text-pink-200',
}

const SCENARIO_LINE_COLOURS: Record<string, string> = {
  BASELINE:       '#6b7280',
  CURRENT_POLICY: '#60a5fa',
  AMBITIOUS:      '#facc15',
  NET_ZERO:       '#4ade80',
}

const SECTOR_LINE_COLOURS: Record<string, string> = {
  POWER:       '#60a5fa',
  TRANSPORT:   '#f472b6',
  INDUSTRY:    '#facc15',
  AGRICULTURE: '#4ade80',
  BUILDINGS:   '#a78bfa',
  FUGITIVE:    '#fb923c',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, Icon }: {
  label: string; value: string; sub?: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-start gap-3">
      <div className="bg-gray-700 rounded-md p-2 mt-1">
        <Icon className="w-5 h-5 text-green-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-gray-200 mb-3 border-b border-gray-700 pb-1">
      {children}
    </h2>
  )
}

// ─── Carbon price scenario chart ──────────────────────────────────────────────
function CarbonPriceChart({ records }: { records: ACPCarbonPriceRecord[] }) {
  const years = [2025, 2030, 2035, 2040, 2045, 2050]
  const scenarios = ['BASELINE', 'CURRENT_POLICY', 'AMBITIOUS', 'NET_ZERO']

  const data = years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const sc of scenarios) {
      const found = records.find(r => r.year === yr && r.scenario === sc)
      row[sc] = found ? found.carbon_price_aud_per_tonne : 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" AUD" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(v: number) => [`$${v.toFixed(0)}/t`, '']}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        {scenarios.map(sc => (
          <Line
            key={sc}
            type="monotone"
            dataKey={sc}
            name={sc.replace(/_/g, ' ')}
            stroke={SCENARIO_LINE_COLOURS[sc]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── ACCU market price chart ──────────────────────────────────────────────────
function ACCUMarketChart({ records }: { records: ACPACCUMarketRecord[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={records} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="month"
          stroke="#9ca3af"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          interval={1}
          angle={-30}
          textAnchor="end"
          height={45}
        />
        <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(v: number) => [`$${v.toFixed(2)}`, '']}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        <Line type="monotone" dataKey="spot_price_aud"  name="Spot"         stroke="#4ade80" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="futures_2025_aud" name="Futures 2025" stroke="#60a5fa" strokeWidth={2} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="futures_2030_aud" name="Futures 2030" stroke="#f472b6" strokeWidth={2} dot={false} strokeDasharray="6 3" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Sector pathways chart (NET_ZERO) ─────────────────────────────────────────
function SectorPathwayChart({ records }: { records: ACPSectorPathwayRecord[] }) {
  const nzRecords = records.filter(r => r.scenario === 'NET_ZERO')
  const years = [2025, 2030, 2035, 2040, 2050]
  const sectors = ['POWER', 'TRANSPORT', 'INDUSTRY', 'AGRICULTURE', 'BUILDINGS', 'FUGITIVE']

  const data = years.map(yr => {
    const row: Record<string, number | string> = { year: yr }
    for (const sec of sectors) {
      const found = nzRecords.find(r => r.year === yr && r.sector === sec)
      row[sec] = found ? found.emissions_mt : 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="year" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" Mt" />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#d1d5db' }}
          formatter={(v: number) => [`${v.toFixed(1)} Mt`, '']}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
        {sectors.map(sec => (
          <Line
            key={sec}
            type="monotone"
            dataKey={sec}
            name={sec}
            stroke={SECTOR_LINE_COLOURS[sec]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Safeguard facilities table ───────────────────────────────────────────────
function SafeguardTable({ facilities }: { facilities: ACPSafeguardRecord[] }) {
  const maxAbs = Math.max(...facilities.map(f => Math.abs(f.surplus_deficit_tco2e)))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-gray-300">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="text-left py-2 pr-3 font-medium">Facility</th>
            <th className="text-left py-2 pr-3 font-medium">Sector</th>
            <th className="text-left py-2 pr-3 font-medium">State</th>
            <th className="text-right py-2 pr-3 font-medium">Baseline (MtCO2e)</th>
            <th className="text-right py-2 pr-3 font-medium">Actual (MtCO2e)</th>
            <th className="text-left py-2 pr-3 font-medium">Surplus / Deficit</th>
            <th className="text-right py-2 pr-3 font-medium">ACCU Cost $m</th>
            <th className="text-left py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {facilities.map(f => {
            const pct = Math.abs(f.surplus_deficit_tco2e) / maxAbs * 100
            const isSurplus = f.surplus_deficit_tco2e >= 0
            return (
              <tr key={f.facility_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-1.5 pr-3 font-medium text-gray-200">{f.facility_name}</td>
                <td className="py-1.5 pr-3">{f.sector}</td>
                <td className="py-1.5 pr-3">{f.state}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {(f.baseline_tco2e / 1e6).toFixed(2)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {(f.actual_emissions_tco2e / 1e6).toFixed(2)}
                </td>
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`tabular-nums ${isSurplus ? 'text-green-400' : 'text-red-400'}`}>
                      {isSurplus ? '+' : ''}{(f.surplus_deficit_tco2e / 1e6).toFixed(2)}
                    </span>
                    <div className="w-20 h-2 bg-gray-700 rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${isSurplus ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {f.accu_cost_aud_m > 0 ? `$${f.accu_cost_aud_m.toFixed(2)}m` : '—'}
                </td>
                <td className="py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${COMPLIANCE_COLOURS[f.compliance_status] ?? 'bg-gray-700 text-gray-200'}`}>
                    {f.compliance_status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Policy instruments table ─────────────────────────────────────────────────
function PolicyInstrumentsTable({ instruments }: { instruments: ACPPolicyInstrumentRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-gray-300">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="text-left py-2 pr-3 font-medium">Instrument</th>
            <th className="text-left py-2 pr-3 font-medium">Type</th>
            <th className="text-left py-2 pr-3 font-medium">Scope</th>
            <th className="text-left py-2 pr-3 font-medium">Strength</th>
            <th className="text-right py-2 pr-3 font-medium">Cost Eff. $/tCO2e</th>
            <th className="text-right py-2 pr-3 font-medium">Abatement Mt/yr</th>
            <th className="text-right py-2 font-medium">Political Feasibility</th>
          </tr>
        </thead>
        <tbody>
          {instruments.map(inst => (
            <tr key={inst.instrument} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="py-1.5 pr-3 font-medium text-gray-200">{inst.instrument}</td>
              <td className="py-1.5 pr-3">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${INSTRUMENT_TYPE_COLOURS[inst.type] ?? 'bg-gray-700 text-gray-200'}`}>
                  {inst.type.replace('_', ' ')}
                </span>
              </td>
              <td className="py-1.5 pr-3">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SCOPE_COLOURS[inst.scope] ?? 'bg-gray-700 text-gray-200'}`}>
                  {inst.scope}
                </span>
              </td>
              <td className="py-1.5 pr-3">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STRENGTH_COLOURS[inst.current_strength] ?? 'bg-gray-700 text-gray-200'}`}>
                  {inst.current_strength}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                ${inst.cost_effectiveness_aud_per_tco2e.toFixed(0)}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {inst.abatement_potential_mt_pa.toFixed(1)}
              </td>
              <td className="py-1.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="w-16 h-2 bg-gray-700 rounded overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded"
                      style={{ width: `${(inst.political_feasibility / 10) * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-gray-300">{inst.political_feasibility.toFixed(1)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AustralianCarbonPolicyAnalytics() {
  const [data, setData] = useState<ACPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAustralianCarbonPolicyDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading Australian Carbon Policy Analytics...
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

  const summary = data.summary as Record<string, number>

  return (
    <div className="bg-gray-900 min-h-screen text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-green-900 rounded-lg p-2">
          <Leaf className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Australian Carbon Policy Analytics</h1>
          <p className="text-sm text-gray-400">
            Safeguard Mechanism · ERF · Carbon Price Scenarios · Emissions Reduction Pathways
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Covered Facilities"
          value={String(summary.total_covered_facilities ?? '—')}
          sub="Safeguard Mechanism"
          Icon={Building2}
        />
        <KpiCard
          label="Total Covered Emissions"
          value={`${summary.total_covered_emissions_mt ?? '—'} Mt`}
          sub="CO2-equivalent"
          Icon={TrendingDown}
        />
        <KpiCard
          label="Non-Compliant Facilities"
          value={String(summary.non_compliant_facilities ?? '—')}
          sub="Require ACCU purchase"
          Icon={AlertTriangle}
        />
        <KpiCard
          label="Current ACCU Price"
          value={`$${(summary.current_accu_price_aud ?? 0).toFixed(2)}`}
          sub="AUD / tonne CO2e"
          Icon={DollarSign}
        />
      </div>

      {/* Carbon price scenarios */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle>Carbon Price Scenarios (AUD/tonne, 2025–2050)</SectionTitle>
        <CarbonPriceChart records={data.carbon_prices} />
      </div>

      {/* ACCU market */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle>ACCU Market Prices — Spot & Futures (2024)</SectionTitle>
        <ACCUMarketChart records={data.accu_market} />
      </div>

      {/* Safeguard facilities */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle>
          Safeguard Mechanism — Covered Facilities ({data.safeguard_facilities.length})
        </SectionTitle>
        <SafeguardTable facilities={data.safeguard_facilities} />
      </div>

      {/* Sector emission pathways */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle>Sector Emissions Pathways — Net Zero Scenario (Mt CO2e)</SectionTitle>
        <SectorPathwayChart records={data.sector_pathways} />
      </div>

      {/* Policy instruments */}
      <div className="bg-gray-800 rounded-lg p-5">
        <SectionTitle>
          Policy Instruments ({data.policy_instruments.length} instruments)
        </SectionTitle>
        <PolicyInstrumentsTable instruments={data.policy_instruments} />
      </div>
    </div>
  )
}
