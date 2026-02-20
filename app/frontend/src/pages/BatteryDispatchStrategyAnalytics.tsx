// Sprint 79b — Grid-Scale Battery Dispatch Strategy Analytics
// Distinct from Sprint 14b BatteryStorageAnalytics (general) and Sprint 23a BatteryArbitrageEconomics
// Focus: BESS dispatch optimisation, arbitrage strategies, market participation patterns

import { useEffect, useMemo, useState } from 'react'
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
  ReferenceLine,
} from 'recharts'
import {
  getBatteryDispatchStrategyDashboard,
  type BSDDashboard,
  type BSDBatteryRecord,
  type BSDDispatchProfileRecord,
  type BSDStrategyPerformanceRecord,
  type BSDMarketParticipationRecord,
} from '../api/client'

// ────────────────────────────────────────────────────────────────────────────────
// Colour palette
// ────────────────────────────────────────────────────────────────────────────────
const CLR = {
  discharge:  '#22d3ee',
  charge:     '#f97316',
  fcasRaise:  '#a78bfa',
  fcasLower:  '#34d399',
  soc:        '#fbbf24',
  netPos:     '#38bdf8',
  arb:        '#f59e0b',
  fcas:       '#8b5cf6',
  network:    '#10b981',
  energy:     '#06b6d4',
  grid:       '#374151',
  text:       '#e5e7eb',
  muted:      '#9ca3af',
  card:       '#1f2937',
  cardBorder: '#374151',
  bg:         '#111827',
  accent:     '#3b82f6',
}

const STRATEGY_COLOURS: Record<string, string> = {
  ARBITRAGE:       CLR.arb,
  FCAS_DOMINANT:   CLR.fcas,
  HYBRID:          CLR.discharge,
  PEAK_SHIFTING:   '#ec4899',
  NETWORK_SUPPORT: CLR.network,
  TRADING:         '#64748b',
}

const REGION_COLOURS: Record<string, string> = {
  SA:  '#f97316',
  NSW: '#22d3ee',
  VIC: '#a78bfa',
  QLD: '#34d399',
}

// ────────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ label, value, sub, accent = CLR.accent }: KpiCardProps) {
  return (
    <div
      style={{
        background: CLR.card,
        border: `1px solid ${CLR.cardBorder}`,
        borderTop: `3px solid ${accent}`,
        borderRadius: 8,
        padding: '16px 20px',
        minWidth: 160,
        flex: '1 1 160px',
      }}
    >
      <div style={{ color: CLR.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ color: CLR.text, fontSize: 26, fontWeight: 700, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ color: CLR.muted, fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ color: CLR.text, fontSize: 18, fontWeight: 600, margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ color: CLR.muted, fontSize: 13, margin: '4px 0 0' }}>{subtitle}</p>}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: CLR.card,
        border: `1px solid ${CLR.cardBorder}`,
        borderRadius: 8,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Revenue bar (inline percentage bar for fleet table)
// ────────────────────────────────────────────────────────────────────────────────
function RevenueSplit({ fcas, arb, net }: { fcas: number; arb: number; net: number }) {
  return (
    <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', minWidth: 100 }}>
      <div
        title={`FCAS: ${fcas.toFixed(1)}%`}
        style={{ width: `${fcas}%`, background: CLR.fcas }}
      />
      <div
        title={`Arbitrage: ${arb.toFixed(1)}%`}
        style={{ width: `${arb}%`, background: CLR.arb }}
      />
      <div
        title={`Network: ${net.toFixed(1)}%`}
        style={{ width: `${net}%`, background: CLR.network }}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Section 1 — Fleet Overview Table
// ────────────────────────────────────────────────────────────────────────────────
function FleetOverview({ batteries }: { batteries: BSDBatteryRecord[] }) {
  const sorted = [...batteries].sort((a, b) => b.capacity_mw - a.capacity_mw)

  const thStyle: React.CSSProperties = {
    color: CLR.muted,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    padding: '8px 12px',
    textAlign: 'left',
    borderBottom: `1px solid ${CLR.cardBorder}`,
    whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    color: CLR.text,
    fontSize: 13,
    padding: '10px 12px',
    borderBottom: `1px solid #1f2937`,
    verticalAlign: 'middle',
  }

  return (
    <Card>
      <SectionHeader
        title="Fleet Overview — Australian Grid-Scale BESS"
        subtitle="Revenue breakdown by stream. Bar segments: FCAS (purple) | Arbitrage (amber) | Network (green)."
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Asset', 'Owner', 'Region', 'MW / MWh', 'Duration', 'Technology', 'Strategy', 'Revenue Split', 'Utilisation', 'Cycles/Day'].map(
                (h) => <th key={h} style={thStyle}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((bat) => (
              <tr key={bat.asset_id} style={{ cursor: 'default' }}>
                <td style={{ ...tdStyle, maxWidth: 200 }}>
                  <div style={{ fontWeight: 600 }}>{bat.name}</div>
                  <div style={{ color: CLR.muted, fontSize: 11 }}>{bat.asset_id}</div>
                </td>
                <td style={{ ...tdStyle, color: CLR.muted, fontSize: 12 }}>{bat.owner}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: REGION_COLOURS[bat.region] + '33',
                      color: REGION_COLOURS[bat.region],
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {bat.region}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ color: CLR.discharge, fontWeight: 600 }}>{bat.capacity_mw.toLocaleString()}</span>
                  {' / '}
                  <span style={{ color: CLR.muted }}>{bat.energy_mwh.toLocaleString()}</span>
                </td>
                <td style={{ ...tdStyle, color: CLR.muted }}>{bat.duration_hr}h</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: '#1e3a5f',
                      color: '#93c5fd',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                    }}
                  >
                    {bat.technology}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      background: (STRATEGY_COLOURS[bat.primary_strategy] ?? CLR.accent) + '22',
                      color: STRATEGY_COLOURS[bat.primary_strategy] ?? CLR.accent,
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {bat.primary_strategy}
                  </span>
                </td>
                <td style={{ ...tdStyle, minWidth: 120 }}>
                  <RevenueSplit
                    fcas={bat.fcas_revenue_pct}
                    arb={bat.arbitrage_revenue_pct}
                    net={bat.network_revenue_pct}
                  />
                  <div style={{ color: CLR.muted, fontSize: 10, marginTop: 3 }}>
                    F:{bat.fcas_revenue_pct.toFixed(0)}% A:{bat.arbitrage_revenue_pct.toFixed(0)}% N:{bat.network_revenue_pct.toFixed(0)}%
                  </div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: `${bat.utilisation_pct}%`,
                        maxWidth: 60,
                        height: 6,
                        background: bat.utilisation_pct > 75 ? CLR.network : CLR.arb,
                        borderRadius: 3,
                      }}
                    />
                    <span style={{ fontSize: 12 }}>{bat.utilisation_pct.toFixed(1)}%</span>
                  </div>
                </td>
                <td style={{ ...tdStyle, color: CLR.soc, fontWeight: 600 }}>
                  {bat.cycles_per_day.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Section 2 — Dispatch Profile by Hour
// ────────────────────────────────────────────────────────────────────────────────
function DispatchProfileChart({
  profiles,
  batteries,
}: {
  profiles: BSDDispatchProfileRecord[]
  batteries: BSDBatteryRecord[]
}) {
  const [selectedAsset, setSelectedAsset] = useState<string>(batteries[0]?.asset_id ?? '')

  const chartData = useMemo(() => {
    const assetProfiles = profiles
      .filter((p) => p.asset_id === selectedAsset)
      .sort((a, b) => a.hour - b.hour)

    return assetProfiles.map((p) => ({
      hour: `${String(p.hour).padStart(2, '0')}:00`,
      'Charge (MW)': Math.abs(p.avg_charge_mw),
      'Discharge (MW)': p.avg_discharge_mw,
      'FCAS Raise': p.fcas_raise_mw,
      'FCAS Lower': p.fcas_lower_mw,
      'Net Position': p.net_position_mw,
      'SoC (%)': p.state_of_charge_pct,
    }))
  }, [profiles, selectedAsset])

  const selectedBat = batteries.find((b) => b.asset_id === selectedAsset)

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <SectionHeader
          title="Hourly Dispatch Profile"
          subtitle="Average MW by hour of day across 2024. Charging shown as positive for readability. SoC on right axis."
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ color: CLR.muted, fontSize: 12 }}>Asset:</label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            style={{
              background: CLR.bg,
              border: `1px solid ${CLR.cardBorder}`,
              color: CLR.text,
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {batteries.map((b) => (
              <option key={b.asset_id} value={b.asset_id}>
                {b.name} ({b.region})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedBat && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { label: 'Strategy', value: selectedBat.primary_strategy, color: STRATEGY_COLOURS[selectedBat.primary_strategy] },
            { label: 'Capacity', value: `${selectedBat.capacity_mw} MW / ${selectedBat.energy_mwh} MWh`, color: CLR.discharge },
            { label: 'Duration', value: `${selectedBat.duration_hr}h`, color: CLR.soc },
            { label: 'Utilisation', value: `${selectedBat.utilisation_pct}%`, color: CLR.network },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: CLR.bg, borderRadius: 6, padding: '8px 14px', border: `1px solid ${CLR.cardBorder}` }}>
              <div style={{ color: CLR.muted, fontSize: 10, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ color, fontSize: 14, fontWeight: 600, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 5, right: 60, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CLR.grid} />
          <XAxis dataKey="hour" tick={{ fill: CLR.muted, fontSize: 11 }} interval={2} />
          <YAxis
            yAxisId="mw"
            tick={{ fill: CLR.muted, fontSize: 11 }}
            label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: CLR.muted, fontSize: 11 }}
          />
          <YAxis
            yAxisId="soc"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: CLR.muted, fontSize: 11 }}
            label={{ value: 'SoC %', angle: 90, position: 'insideRight', fill: CLR.muted, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: `1px solid ${CLR.cardBorder}`, borderRadius: 6 }}
            labelStyle={{ color: CLR.text, fontWeight: 600 }}
            itemStyle={{ color: CLR.muted }}
          />
          <Legend wrapperStyle={{ color: CLR.muted, fontSize: 12 }} />
          <ReferenceLine yAxisId="mw" y={0} stroke={CLR.cardBorder} strokeDasharray="4 4" />
          <Line yAxisId="mw" type="monotone" dataKey="Discharge (MW)" stroke={CLR.discharge} strokeWidth={2.5} dot={false} />
          <Line yAxisId="mw" type="monotone" dataKey="Charge (MW)" stroke={CLR.charge} strokeWidth={2.5} dot={false} strokeDasharray="5 3" />
          <Line yAxisId="mw" type="monotone" dataKey="FCAS Raise" stroke={CLR.fcasRaise} strokeWidth={1.5} dot={false} />
          <Line yAxisId="mw" type="monotone" dataKey="FCAS Lower" stroke={CLR.fcasLower} strokeWidth={1.5} dot={false} />
          <Line yAxisId="mw" type="monotone" dataKey="Net Position" stroke={CLR.netPos} strokeWidth={2} dot={false} strokeDasharray="3 2" />
          <Line yAxisId="soc" type="monotone" dataKey="SoC (%)" stroke={CLR.soc} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { color: CLR.discharge, label: 'Discharge (MW)' },
          { color: CLR.charge,    label: 'Charge (MW)' },
          { color: CLR.fcasRaise, label: 'FCAS Raise' },
          { color: CLR.fcasLower, label: 'FCAS Lower' },
          { color: CLR.netPos,    label: 'Net Position' },
          { color: CLR.soc,       label: 'SoC %' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 3, background: color, borderRadius: 2 }} />
            <span style={{ color: CLR.muted, fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Section 3 — Strategy Performance (grouped bar by region)
// ────────────────────────────────────────────────────────────────────────────────
function StrategyPerformanceChart({
  data,
}: {
  data: BSDStrategyPerformanceRecord[]
}) {
  const [metric, setMetric] = useState<'revenue_per_mwh_capacity' | 'net_revenue_per_mwh' | 'arbitrage_spread_captured' | 'fcas_service_hours_pct'>(
    'revenue_per_mwh_capacity'
  )

  const metricLabels: Record<string, string> = {
    revenue_per_mwh_capacity: 'Gross Revenue $/MWh Capacity',
    net_revenue_per_mwh:      'Net Revenue $/MWh Capacity',
    arbitrage_spread_captured:'Avg Arbitrage Spread ($)',
    fcas_service_hours_pct:   'FCAS Service Hours (%)',
  }

  // Transform: group by strategy, regions as bars
  const strategies = [...new Set(data.map((d) => d.strategy))]
  const regions    = ['SA', 'NSW', 'VIC', 'QLD']

  const chartData = strategies.map((strat) => {
    const row: Record<string, unknown> = { strategy: strat }
    regions.forEach((reg) => {
      const rec = data.find((d) => d.strategy === strat && d.region === reg)
      row[reg] = rec ? +(rec[metric] as number).toFixed(1) : 0
    })
    return row
  })

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <SectionHeader
          title="Strategy Performance by Region — 2024-Q3"
          subtitle="Revenue and operational metrics per installed MWh of capacity."
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ color: CLR.muted, fontSize: 12 }}>Metric:</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
            style={{
              background: CLR.bg,
              border: `1px solid ${CLR.cardBorder}`,
              color: CLR.text,
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {Object.entries(metricLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CLR.grid} vertical={false} />
          <XAxis
            dataKey="strategy"
            tick={{ fill: CLR.muted, fontSize: 11 }}
            angle={-15}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fill: CLR.muted, fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: `1px solid ${CLR.cardBorder}`, borderRadius: 6 }}
            labelStyle={{ color: CLR.text, fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ color: CLR.muted, fontSize: 12 }} />
          {regions.map((reg) => (
            <Bar key={reg} dataKey={reg} fill={REGION_COLOURS[reg]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Performance summary table */}
      <div style={{ marginTop: 20, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Strategy', 'Avg Revenue $/MWh', 'Net $/MWh', 'FCAS Hrs %', 'Cycle Count', 'Degradation $/MWh'].map((h) => (
                <th
                  key={h}
                  style={{
                    color: CLR.muted, fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', padding: '8px 12px',
                    borderBottom: `1px solid ${CLR.cardBorder}`, textAlign: 'right',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strategies.map((strat) => {
              const records = data.filter((d) => d.strategy === strat)
              const avg = (key: keyof BSDStrategyPerformanceRecord) =>
                records.reduce((s, r) => s + (r[key] as number), 0) / records.length
              return (
                <tr key={strat}>
                  <td style={{ color: STRATEGY_COLOURS[strat] ?? CLR.text, fontSize: 13, fontWeight: 600, padding: '10px 12px', borderBottom: `1px solid #1f2937`, textAlign: 'right' }}>
                    {strat}
                  </td>
                  <td style={{ color: CLR.text, fontSize: 13, padding: '10px 12px', borderBottom: `1px solid #1f2937`, textAlign: 'right' }}>
                    ${avg('revenue_per_mwh_capacity').toFixed(1)}
                  </td>
                  <td style={{ color: CLR.network, fontSize: 13, padding: '10px 12px', borderBottom: `1px solid #1f2937`, textAlign: 'right' }}>
                    ${avg('net_revenue_per_mwh').toFixed(1)}
                  </td>
                  <td style={{ color: CLR.fcas, fontSize: 13, padding: '10px 12px', borderBottom: `1px solid #1f2937`, textAlign: 'right' }}>
                    {avg('fcas_service_hours_pct').toFixed(1)}%
                  </td>
                  <td style={{ color: CLR.discharge, fontSize: 13, padding: '10px 12px', borderBottom: `1px solid #1f2937`, textAlign: 'right' }}>
                    {Math.round(avg('cycle_count'))}
                  </td>
                  <td style={{ color: CLR.charge, fontSize: 13, padding: '10px 12px', borderBottom: `1px solid #1f2937`, textAlign: 'right' }}>
                    ${avg('degradation_cost_per_mwh').toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Section 4 — Market Participation (monthly energy vs FCAS)
// ────────────────────────────────────────────────────────────────────────────────
function MarketParticipationChart({
  data,
  batteries,
}: {
  data: BSDMarketParticipationRecord[]
  batteries: BSDBatteryRecord[]
}) {
  const [selectedAsset, setSelectedAsset] = useState<string>(batteries[0]?.asset_id ?? '')

  const chartData = useMemo(() => {
    return data
      .filter((d) => d.asset_id === selectedAsset)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => ({
        month: d.month.slice(5), // "MM"
        'Energy Traded (MWh)': d.energy_traded_mwh,
        'FCAS Raise (MWh)':    d.fcas_raise_mwh,
        'FCAS Lower (MWh)':    d.fcas_lower_mwh,
        'Contingency FCAS':    d.contingency_fcas_mwh,
        'Revenue ($k)':        d.total_revenue_k,
        'Charge Price':        d.avg_charge_price,
        'Discharge Price':     d.avg_discharge_price,
      }))
  }, [data, selectedAsset])

  const selectedBat = batteries.find((b) => b.asset_id === selectedAsset)
  const totalRevenue = data
    .filter((d) => d.asset_id === selectedAsset)
    .reduce((s, d) => s + d.total_revenue_k, 0)
  const avgSpread = data
    .filter((d) => d.asset_id === selectedAsset)
    .reduce((s, d) => s + (d.avg_discharge_price - d.avg_charge_price), 0) /
    Math.max(data.filter((d) => d.asset_id === selectedAsset).length, 1)

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <SectionHeader
          title="Market Participation — Monthly Energy & FCAS Volume"
          subtitle="2024 monthly breakdown of energy market and FCAS service participation."
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ color: CLR.muted, fontSize: 12 }}>Asset:</label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            style={{
              background: CLR.bg,
              border: `1px solid ${CLR.cardBorder}`,
              color: CLR.text,
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {batteries.slice(0, 5).map((b) => (
              <option key={b.asset_id} value={b.asset_id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedBat && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { label: '2024 Total Revenue', value: `$${(totalRevenue / 1000).toFixed(1)}M`, color: CLR.network },
            { label: 'Avg Price Spread',   value: `$${avgSpread.toFixed(0)}/MWh`,          color: CLR.arb },
            { label: 'Region',             value: selectedBat.region,                        color: REGION_COLOURS[selectedBat.region] },
            { label: 'Primary Strategy',   value: selectedBat.primary_strategy,              color: STRATEGY_COLOURS[selectedBat.primary_strategy] },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: CLR.bg, borderRadius: 6, padding: '8px 14px', border: `1px solid ${CLR.cardBorder}` }}>
              <div style={{ color: CLR.muted, fontSize: 10, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ color, fontSize: 14, fontWeight: 600, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CLR.grid} vertical={false} />
          <XAxis dataKey="month" tick={{ fill: CLR.muted, fontSize: 12 }} />
          <YAxis tick={{ fill: CLR.muted, fontSize: 11 }} label={{ value: 'MWh', angle: -90, position: 'insideLeft', fill: CLR.muted, fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: `1px solid ${CLR.cardBorder}`, borderRadius: 6 }}
            labelStyle={{ color: CLR.text, fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ color: CLR.muted, fontSize: 12 }} />
          <Bar dataKey="Energy Traded (MWh)" stackId="a" fill={CLR.discharge} radius={[0, 0, 0, 0]} />
          <Bar dataKey="FCAS Raise (MWh)"    stackId="a" fill={CLR.fcasRaise} />
          <Bar dataKey="FCAS Lower (MWh)"    stackId="a" fill={CLR.fcasLower} />
          <Bar dataKey="Contingency FCAS"    stackId="a" fill="#6366f1" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Section 5 — Optimal Dispatch Scenarios
// ────────────────────────────────────────────────────────────────────────────────
function OptimalDispatchTable({
  data,
}: {
  data: BSDDashboard['optimal_dispatch']
}) {
  const [filterRegion, setFilterRegion] = useState<string>('ALL')
  const regions = ['ALL', 'SA', 'NSW', 'VIC', 'QLD']
  const filtered = filterRegion === 'ALL' ? data : data.filter((d) => d.region === filterRegion)

  const thStyle: React.CSSProperties = {
    color: CLR.muted, fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.8,
    padding: '8px 12px', borderBottom: `1px solid ${CLR.cardBorder}`,
    textAlign: 'right',
  }
  const tdStyle: React.CSSProperties = {
    color: CLR.text, fontSize: 13,
    padding: '10px 12px', borderBottom: `1px solid #1f2937`,
    textAlign: 'right',
  }

  const scenarioColors: Record<string, string> = {
    CURRENT_MARKET:      CLR.discharge,
    HIGH_VRE:            CLR.network,
    HIGH_PRICE_VOL:      CLR.arb,
    NETWORK_CONSTRAINED: '#ec4899',
    EXTREME_PEAK:        '#f43f5e',
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <SectionHeader
          title="Optimal Dispatch Scenarios"
          subtitle="Recommended charge/discharge windows and expected returns by market scenario and region."
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => setFilterRegion(r)}
              style={{
                background: filterRegion === r ? CLR.accent : CLR.bg,
                color: filterRegion === r ? '#fff' : CLR.muted,
                border: `1px solid ${filterRegion === r ? CLR.accent : CLR.cardBorder}`,
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: filterRegion === r ? 600 : 400,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Scenario', 'Region', 'Duration (h)', 'Charge Window', 'Discharge Window', 'Daily Revenue', 'Annual Revenue', 'Payback (yrs)'].map(
                (h, i) => <th key={h} style={{ ...thStyle, textAlign: i < 2 ? 'left' : 'right' }}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((rec, i) => (
              <tr key={i}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>
                  <span
                    style={{
                      background: (scenarioColors[rec.scenario] ?? CLR.accent) + '22',
                      color: scenarioColors[rec.scenario] ?? CLR.accent,
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {rec.scenario}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'left' }}>
                  <span style={{ color: REGION_COLOURS[rec.region], fontWeight: 600 }}>{rec.region}</span>
                </td>
                <td style={tdStyle}>{rec.optimal_duration_hr}h</td>
                <td style={{ ...tdStyle, color: CLR.charge, fontFamily: 'monospace', fontSize: 12 }}>
                  {rec.optimal_charge_window}
                </td>
                <td style={{ ...tdStyle, color: CLR.discharge, fontFamily: 'monospace', fontSize: 12 }}>
                  {rec.optimal_discharge_window}
                </td>
                <td style={{ ...tdStyle, color: CLR.soc, fontWeight: 600 }}>
                  ${rec.expected_daily_revenue.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, color: CLR.network, fontWeight: 600 }}>
                  ${rec.expected_annual_revenue_m.toFixed(2)}M
                </td>
                <td style={{
                  ...tdStyle,
                  color: rec.simple_payback_years <= 8 ? CLR.network : rec.simple_payback_years <= 11 ? CLR.arb : '#f87171',
                  fontWeight: 600,
                }}>
                  {rec.simple_payback_years.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Main page component
// ────────────────────────────────────────────────────────────────────────────────
export default function BatteryDispatchStrategyAnalytics() {
  const [data, setData]       = useState<BSDDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getBatteryDispatchStrategyDashboard()
      .then(setData)
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: CLR.muted, fontSize: 15 }}>
        Loading Battery Dispatch Strategy data...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#f87171', fontSize: 15 }}>
        {error ?? 'Failed to load data.'}
      </div>
    )
  }

  const s = data.summary as Record<string, number | string>

  return (
    <div
      style={{
        background: CLR.bg,
        minHeight: '100vh',
        color: CLR.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px 28px',
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 6, height: 28, background: CLR.accent, borderRadius: 3 }} />
          <h1 style={{ color: CLR.text, fontSize: 24, fontWeight: 700, margin: 0 }}>
            Grid-Scale Battery Dispatch Strategy Analytics
          </h1>
          <span style={{ background: '#1e3a5f', color: '#93c5fd', borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
            Sprint 79b
          </span>
        </div>
        <p style={{ color: CLR.muted, fontSize: 13, margin: '0 0 0 18px' }}>
          BESS dispatch optimisation, FCAS & arbitrage strategy performance, real-time market participation patterns — Australian NEM 2024
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <KpiCard
          label="Total Installed"
          value={`${(s.total_installed_mw as number).toLocaleString()} MW`}
          sub={`${(s.total_installed_mwh as number).toLocaleString()} MWh`}
          accent={CLR.discharge}
        />
        <KpiCard
          label="Avg FCAS Revenue"
          value={`${s.avg_fcas_revenue_pct}%`}
          sub="of total revenue from FCAS"
          accent={CLR.fcas}
        />
        <KpiCard
          label="Avg Utilisation"
          value={`${s.avg_utilisation_pct}%`}
          sub="of capacity deployed avg"
          accent={CLR.network}
        />
        <KpiCard
          label="Avg Cycles/Day"
          value={`${s.avg_cycles_per_day}`}
          sub="full equivalent cycles"
          accent={CLR.arb}
        />
        <KpiCard
          label="Top Strategy"
          value={s.highest_revenue_strategy as string}
          sub="by revenue per MWh"
          accent={CLR.fcas}
        />
        <KpiCard
          label="Total Annual Revenue"
          value={`$${s.total_annual_revenue_m}M`}
          sub="fleet-wide NEM 2024 est."
          accent={CLR.soc}
        />
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <FleetOverview batteries={data.batteries} />
        <DispatchProfileChart profiles={data.dispatch_profiles} batteries={data.batteries} />
        <StrategyPerformanceChart data={data.strategy_performance} />
        <MarketParticipationChart data={data.market_participation} batteries={data.batteries} />
        <OptimalDispatchTable data={data.optimal_dispatch} />
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 32, padding: '16px 20px', background: '#0f172a', borderRadius: 8, border: `1px solid ${CLR.cardBorder}` }}>
        <p style={{ color: CLR.muted, fontSize: 12, margin: 0 }}>
          <strong style={{ color: CLR.text }}>Note:</strong> Sprint 79b — distinct from Sprint 14b BatteryStorageAnalytics (general fleet metrics) and
          Sprint 23a BatteryArbitrageEconomics (wholesale arbitrage economics). This page focuses specifically on real-time dispatch strategy
          optimisation, hourly dispatch profiles, FCAS vs arbitrage participation patterns, and scenario-based optimal dispatch modelling for
          Australian grid-scale BESS assets.
        </p>
      </div>
    </div>
  )
}
