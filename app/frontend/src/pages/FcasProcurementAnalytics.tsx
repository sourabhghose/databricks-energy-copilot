// Sprint 142c — FCAP: FCAS Procurement & Cost Analytics
// NEM FCAS market procurement: services, providers, regional requirements,
// cost trends and monthly pricing across all 8 FCAS services.

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts'
import { Activity } from 'lucide-react'
import { getFcasProcurementDashboard, FCAPDashboard } from '../api/client'

// ── colour palettes ───────────────────────────────────────────────────────────
const SERVICE_TYPE_COLOURS: Record<string, string> = {
  Contingency: '#6366f1',
  Regulation:  '#f59e0b',
}

const PROVIDER_TYPE_COLOURS: Record<string, string> = {
  Battery:       '#22c55e',
  Hydro:         '#3b82f6',
  'Gas Peaker':  '#f59e0b',
  'Pumped Hydro':'#a78bfa',
  'Industrial DR':'#ef4444',
  'Wind+Storage':'#10b981',
  Aggregator:    '#f97316',
}

const REGION_COLOURS: Record<string, string> = {
  NSW1: '#6366f1',
  QLD1: '#f59e0b',
  VIC1: '#3b82f6',
  SA1:  '#ef4444',
  TAS1: '#10b981',
}

const RAISE_SERVICE_COLOURS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444']
const RAISE_SERVICE_IDS     = ['SVC01', 'SVC03', 'SVC05', 'SVC07']
const RAISE_SERVICE_NAMES   = ['Raise 6s', 'Raise 60s', 'Raise 5min', 'Raise Reg']

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt1(n: number) { return n.toFixed(1) }
function fmt2(n: number) { return n.toFixed(2) }

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── tooltip style ─────────────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' },
  labelStyle:   { color: '#f3f4f6' },
  itemStyle:    { color: '#d1d5db' },
}

// ── main component ─────────────────────────────────────────────────────────────
export default function FcasProcurementAnalytics() {
  const [data, setData]       = useState<FCAPDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getFcasProcurementDashboard()
      .then(d  => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-gray-400 animate-pulse">Loading FCAS Procurement Analytics…</p>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <p className="text-red-400">Failed to load data: {error}</p>
      </div>
    )
  }

  const { services, monthly, providers, regional_requirements, cost_trends, summary } = data

  // ── Chart 1: service procurement cost coloured by service_type ────────────
  const chart1Data = services.map(s => ({
    name:  s.service_name,
    value: s.procurement_cost_m_aud_2024,
    type:  s.service_type,
  }))

  // ── Chart 2: monthly avg_price_mwh for 4 raise services (2024) ───────────
  // Pivot: month → {SVC01, SVC03, SVC05, SVC07}
  const monthlyRaise = monthly.filter(m => RAISE_SERVICE_IDS.includes(m.service_id))
  const chart2Map: Record<number, Record<string, number | string>> = {}
  for (let mo = 1; mo <= 12; mo++) {
    chart2Map[mo] = { month: `M${mo.toString().padStart(2, '0')}` }
  }
  monthlyRaise.forEach(m => {
    chart2Map[m.month][m.service_id] = m.avg_price_mwh
  })
  const chart2Data = Object.values(chart2Map)

  // ── Chart 3: top 15 providers by fcas_revenue coloured by provider_type ──
  const top15Providers = [...providers]
    .sort((a, b) => b.fcas_revenue_m_aud_2024 - a.fcas_revenue_m_aud_2024)
    .slice(0, 15)
  const chart3Data = top15Providers.map(p => ({
    name:  p.provider_name.split(' ').slice(0, 2).join(' '),
    value: p.fcas_revenue_m_aud_2024,
    type:  p.provider_type,
  }))

  // ── Chart 4: stacked bar — quarterly cost trend 2022-2024 ─────────────────
  const chart4Data = cost_trends.map(ct => ({
    label:   `${ct.year} ${ct.quarter}`,
    cont_r:  ct.contingency_raise_cost_m_aud,
    cont_l:  ct.contingency_lower_cost_m_aud,
    reg_r:   ct.regulation_raise_cost_m_aud,
    reg_l:   ct.regulation_lower_cost_m_aud,
  }))

  // ── Chart 5: regional cost_premium_pct by service across regions ──────────
  // Only 2024 data; show Raise 6s and Raise Reg for each region
  const regionList = ['NSW1', 'VIC1', 'SA1', 'QLD1', 'TAS1']
  const premiumSvcIds = ['SVC01', 'SVC07']
  const premiumSvcNames: Record<string, string> = { SVC01: 'Raise 6s', SVC07: 'Raise Reg' }

  const chart5Map: Record<string, Record<string, number | string>> = {}
  regionList.forEach(r => { chart5Map[r] = { region: r } })
  regional_requirements
    .filter(rr => rr.year === 2024 && premiumSvcIds.includes(rr.service_id))
    .forEach(rr => {
      if (chart5Map[rr.region]) {
        chart5Map[rr.region][premiumSvcNames[rr.service_id]] = rr.cost_premium_pct
      }
    })
  const chart5Data = regionList.map(r => chart5Map[r])

  return (
    <div className="p-6 bg-gray-900 min-h-full text-gray-100">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-600 rounded-lg">
          <Activity size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">FCAS Procurement &amp; Cost Analytics</h1>
          <p className="text-sm text-gray-400">
            NEM Frequency Control Ancillary Services — procurement costs, provider landscape and regional requirements
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Total FCAS Cost 2024"
          value={`$${fmt2(summary.total_fcas_cost_m_aud_2024)}M`}
          sub="All 8 services AUD"
        />
        <KPICard
          label="Most Expensive Service"
          value={summary.most_expensive_service}
          sub="Highest procurement cost 2024"
        />
        <KPICard
          label="Total Providers"
          value={String(summary.total_providers)}
          sub="Enabled FCAS market participants"
        />
        <KPICard
          label="Avg Compliance"
          value={`${fmt1(summary.avg_compliance_pct)}%`}
          sub="Response compliance across providers"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1 — Service procurement cost by type */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            FCAS Service Procurement Cost 2024 ($M AUD)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chart1Data} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`$${fmt2(v)}M`, 'Cost']} />
              <Bar dataKey="value" name="Cost ($M)">
                {chart1Data.map((entry, i) => (
                  <Cell key={i} fill={SERVICE_TYPE_COLOURS[entry.type] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center text-xs text-gray-400">
            {Object.entries(SERVICE_TYPE_COLOURS).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 2 — Monthly avg price for 4 raise services */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Monthly Avg Price ($/MWh) — Raise Services 2024
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart2Data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`$${fmt2(v)}/MWh`]} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {RAISE_SERVICE_IDS.map((sid, i) => (
                <Line
                  key={sid}
                  type="monotone"
                  dataKey={sid}
                  name={RAISE_SERVICE_NAMES[i]}
                  stroke={RAISE_SERVICE_COLOURS[i]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3 — Top 15 providers by revenue */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Top 15 Providers — FCAS Revenue 2024 ($M AUD)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart3Data} layout="vertical" margin={{ top: 5, right: 20, left: 90, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={90} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`$${fmt2(v)}M`, 'Revenue']} />
              <Bar dataKey="value" name="Revenue ($M)">
                {chart3Data.map((entry, i) => (
                  <Cell key={i} fill={PROVIDER_TYPE_COLOURS[entry.type] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center text-xs text-gray-400">
            {Object.entries(PROVIDER_TYPE_COLOURS).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* Chart 4 — Stacked quarterly cost trend */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Quarterly FCAS Cost Breakdown ($M AUD) — 2022–2024
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart4Data} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`$${fmt2(v)}M`]} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
              <Bar dataKey="cont_r" name="Contingency Raise" stackId="a" fill="#6366f1" />
              <Bar dataKey="cont_l" name="Contingency Lower" stackId="a" fill="#a78bfa" />
              <Bar dataKey="reg_r"  name="Regulation Raise"  stackId="a" fill="#f59e0b" />
              <Bar dataKey="reg_l"  name="Regulation Lower"  stackId="a" fill="#fcd34d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5 — Regional cost premium by service */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            Regional Cost Premium (%) by Service — 2024
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chart5Data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${fmt2(v)}%`, 'Cost Premium']} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {Object.values(premiumSvcNames).map((sname, i) => (
                <Bar key={sname} dataKey={sname} name={sname} fill={i === 0 ? '#6366f1' : '#f59e0b'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  )
}
