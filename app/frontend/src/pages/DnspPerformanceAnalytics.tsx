// Sprint 61b — DNSP Performance & Investment Analytics

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
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Network } from 'lucide-react'
import {
  getDnspAnalyticsDashboard,
  DnspAnalyticsDashboard61b,
  DPADnspRecord,
  DPAReliabilityRecord,
  DPADerHostingRecord,
  DPAInvestmentRecord,
} from '../api/client'

// ─── colour palettes ──────────────────────────────────────────────────────────

const DNSP_COLOURS: Record<string, string> = {
  'Ausgrid':                    '#f59e0b',
  'Endeavour Energy':           '#3b82f6',
  'Essential Energy':           '#ef4444',
  'Evoenergy':                  '#10b981',
  'SA Power Networks':          '#a855f7',
  'CitiPower':                  '#06b6d4',
  'Powercor':                   '#f97316',
  'United Energy':              '#84cc16',
  'Jemena Electricity Networks':'#e879f9',
  'TasNetworks Distribution':   '#64748b',
}

const CONSTRAINT_COLOURS: Record<string, string> = {
  VOLTAGE:       '#ef4444',
  THERMAL:       '#f97316',
  PROTECTION:    '#a855f7',
  UNCONSTRAINED: '#10b981',
}

const CATEGORY_COLOURS: Record<string, string> = {
  RELIABILITY:         '#3b82f6',
  GROWTH:              '#10b981',
  SAFETY:              '#f59e0b',
  DER_INTEGRATION:     '#a855f7',
  BUSHFIRE_MITIGATION: '#ef4444',
  CYBER_SECURITY:      '#64748b',
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 1) {
  return n.toFixed(dec)
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string
  value: string
  sub?: string
  accent?: string
}

function KpiCard({ label, value, sub, accent = 'border-blue-500' }: KpiProps) {
  return (
    <div className={`bg-gray-800 rounded-xl p-5 border-l-4 ${accent}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DnspPerformanceAnalytics() {
  const [data, setData] = useState<DnspAnalyticsDashboard61b | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDnspAnalyticsDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-red-400 p-8 text-center">
        Failed to load DNSP analytics: {error ?? 'unknown error'}
      </div>
    )
  }

  const dnsps: DPADnspRecord[]             = data.dnsps
  const reliability: DPAReliabilityRecord[] = data.reliability
  const derHosting: DPADerHostingRecord[]   = data.der_hosting
  const investments: DPAInvestmentRecord[]  = data.investments

  // ── KPI derivations ──────────────────────────────────────────────────────
  const totalRab = dnsps.reduce((s, d) => s + d.regulated_asset_base_bn_aud, 0)
  const latest2024 = reliability.filter(r => r.year === 2024)
  const avgSaidi = latest2024.reduce((s, r) => s + r.saidi_minutes, 0) / (latest2024.length || 1)
  const totalDerConnected = derHosting.reduce((s, r) => s + r.connected_der_mw, 0)
  const totalInvestment = investments.reduce((s, r) => s + r.investment_m_aud, 0)

  // ── SAIDI/SAIFI grouped bar data (latest year) ───────────────────────────
  const reliabilityBarData = latest2024.map(r => ({
    dnsp: r.dnsp.replace(' Energy', '').replace(' Networks', '').replace(' Distribution', '').replace(' Electricity Networks', ''),
    SAIDI: r.saidi_minutes,
    SAIFI: r.saifi_interruptions,
  }))

  // ── DER scatter data ─────────────────────────────────────────────────────
  const scatterData = derHosting.map(r => {
    const dnspInfo = dnsps.find(d => d.dnsp_name === r.dnsp)
    return {
      x: r.connected_der_mw,
      y: r.hosting_capacity_mw,
      z: (dnspInfo?.regulated_asset_base_bn_aud ?? 1) * 100,
      constraint: r.constraint_type,
      dnsp: r.dnsp,
      feeder: r.feeder_type,
    }
  })

  // ── Investment stacked bar by DNSP ───────────────────────────────────────
  const dnspNames = Array.from(new Set(investments.map(i => i.dnsp)))
  const categories = ['RELIABILITY', 'GROWTH', 'SAFETY', 'DER_INTEGRATION', 'BUSHFIRE_MITIGATION', 'CYBER_SECURITY']

  const investmentBarData = dnspNames.map(name => {
    const row: Record<string, string | number> = {
      dnsp: name.replace(' Energy', '').replace(' Networks', '').replace(' Distribution', '').replace(' Electricity Networks', ''),
    }
    categories.forEach(cat => {
      const sum = investments
        .filter(i => i.dnsp === name && i.project_category === cat)
        .reduce((s, i) => s + i.investment_m_aud, 0)
      row[cat] = sum
    })
    return row
  })

  return (
    <div className="p-6 space-y-8 text-gray-100 min-h-screen bg-gray-900">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Network className="w-7 h-7 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">DNSP Performance &amp; Investment Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Regulated asset base, SAIDI/SAIFI reliability, DER hosting capacity and network investment — 10 Australian DNSPs
          </p>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total National DNSP RAB"
          value={`$${fmt(totalRab, 1)} bn AUD`}
          sub="Sum across 10 DNSPs"
          accent="border-blue-500"
        />
        <KpiCard
          label="Average SAIDI (2024)"
          value={`${fmt(avgSaidi, 1)} min`}
          sub="National average"
          accent="border-amber-500"
        />
        <KpiCard
          label="Total DER Connected"
          value={`${Math.round(totalDerConnected).toLocaleString()} MW`}
          sub="Across all feeder types"
          accent="border-emerald-500"
        />
        <KpiCard
          label="Total Annual Investment"
          value={`$${Math.round(totalInvestment).toLocaleString()} M AUD`}
          sub="FY2024 across all categories"
          accent="border-purple-500"
        />
      </div>

      {/* ── DNSP overview table ─────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">DNSP Overview — Regulated Parameters</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">DNSP</th>
                <th className="text-left py-2 pr-4">State</th>
                <th className="text-right py-2 pr-4">RAB (bn AUD)</th>
                <th className="text-right py-2 pr-4">Customers (k)</th>
                <th className="text-right py-2 pr-4">Network (km)</th>
                <th className="text-right py-2 pr-4">WACC %</th>
                <th className="text-right py-2 pr-4">CapEx (M)</th>
                <th className="text-right py-2 pr-4">OpEx (M)</th>
                <th className="text-left py-2">Determination</th>
              </tr>
            </thead>
            <tbody>
              {dnsps.map(d => (
                <tr key={d.dnsp_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2 pr-4 font-medium" style={{ color: DNSP_COLOURS[d.dnsp_name] ?? '#94a3b8' }}>
                    {d.dnsp_name}
                  </td>
                  <td className="py-2 pr-4 text-gray-300">{d.state}</td>
                  <td className="py-2 pr-4 text-right text-white">{fmt(d.regulated_asset_base_bn_aud)}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{d.customers_k.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{d.network_length_km.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-gray-300">{fmt(d.wacc_pct)}</td>
                  <td className="py-2 pr-4 text-right text-emerald-400">${d.annual_capex_m_aud.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-blue-400">${d.annual_opex_m_aud.toLocaleString()}</td>
                  <td className="py-2 text-gray-400 text-xs">{d.determination_period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SAIDI/SAIFI reliability comparison ─────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-1">SAIDI / SAIFI Reliability Comparison — 2024</h2>
        <p className="text-xs text-gray-400 mb-4">Lower is better. SAIDI = total minutes off supply per customer. SAIFI = number of interruptions per customer.</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={reliabilityBarData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="dnsp" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis yAxisId="saidi" orientation="left" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'SAIDI (min)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <YAxis yAxisId="saifi" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'SAIFI', angle: 90, position: 'insideRight', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            <Bar yAxisId="saidi" dataKey="SAIDI" name="SAIDI (min)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="saifi" dataKey="SAIFI" name="SAIFI (interruptions)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── DER hosting scatter ─────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-1">DER Hosting Capacity vs Connected DER</h2>
        <p className="text-xs text-gray-400 mb-4">
          Bubble size proportional to DNSP RAB. Colour indicates primary network constraint type.
        </p>
        <div className="flex flex-wrap gap-4 mb-4">
          {Object.entries(CONSTRAINT_COLOURS).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c }} />
              {k}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="x" name="Connected DER (MW)" type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Connected DER (MW)', position: 'insideBottom', offset: -4, fill: '#9ca3af', fontSize: 11 }} />
            <YAxis dataKey="y" name="Hosting Capacity (MW)" type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Hosting Capacity (MW)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <ZAxis dataKey="z" range={[40, 800]} name="RAB proxy" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              content={({ payload }) => {
                if (!payload || !payload.length) return null
                const d = payload[0].payload
                return (
                  <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-semibold text-white">{d.dnsp}</p>
                    <p className="text-gray-300">Feeder: {d.feeder}</p>
                    <p className="text-gray-300">Connected DER: {d.x} MW</p>
                    <p className="text-gray-300">Hosting Cap: {d.y} MW</p>
                    <p style={{ color: CONSTRAINT_COLOURS[d.constraint] }}>Constraint: {d.constraint}</p>
                  </div>
                )
              }}
            />
            <Scatter
              data={scatterData}
              name="Feeder"
            >
              {scatterData.map((entry, idx) => (
                <Cell key={idx} fill={CONSTRAINT_COLOURS[entry.constraint] ?? '#94a3b8'} fillOpacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* ── Investment stacked bar ──────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-1">Annual Network Investment by Category — FY2024</h2>
        <p className="text-xs text-gray-400 mb-4">Stacked by project category, in M AUD. Hover for breakdown.</p>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={investmentBarData} margin={{ top: 4, right: 16, left: 0, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="dnsp" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'M AUD', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
              formatter={(value: number) => [`$${value.toFixed(0)}M`, undefined]}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', paddingTop: 8 }} />
            {categories.map(cat => (
              <Bar
                key={cat}
                dataKey={cat}
                name={cat.replace(/_/g, ' ')}
                stackId="a"
                fill={CATEGORY_COLOURS[cat]}
                radius={cat === 'CYBER_SECURITY' ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── SAIDI trend line chart ──────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-1">SAIDI Reliability Trend — 2022 to 2024</h2>
        <p className="text-xs text-gray-400 mb-4">Improving (downward) trends indicate reliability programme success.</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" type="number" domain={[2022, 2024]} ticks={[2022, 2023, 2024]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'SAIDI (min)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb' }} itemStyle={{ color: '#d1d5db' }} />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {Object.entries(DNSP_COLOURS).map(([dnspName, colour]) => {
              const seriesData = reliability
                .filter(r => r.dnsp === dnspName)
                .sort((a, b) => a.year - b.year)
                .map(r => ({ year: r.year, saidi: r.saidi_minutes }))
              if (!seriesData.length) return null
              const shortName = dnspName
                .replace(' Energy', '')
                .replace(' Networks', '')
                .replace(' Distribution', '')
                .replace(' Electricity Networks', '')
              return (
                <Line
                  key={dnspName}
                  data={seriesData}
                  type="monotone"
                  dataKey="saidi"
                  name={shortName}
                  stroke={colour}
                  strokeWidth={2}
                  dot={{ r: 4, fill: colour }}
                  activeDot={{ r: 6 }}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-500 text-right">
        Data: Mock regulatory determinations — AER DNSP revenue determination periods. Sprint 61b.
      </p>
    </div>
  )
}
