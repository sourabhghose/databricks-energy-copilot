// Sprint 143b — RECSX: Renewable Energy Certificate (LGC/STC) Market Analytics
// Australian REC/LGC/STC market: prices, creation, liability, project pipeline
// and voluntary market breakdown. Dark theme, Award icon.

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
  ComposedChart,
} from 'recharts'
import { Award } from 'lucide-react'
import {
  getRenewableEnergyCertificateXDashboard,
  RECSXDashboard,
} from '../api/client'

// ── colour palettes ──────────────────────────────────────────────────────────
const TECH_COLOURS: Record<string, string> = {
  Wind:   '#6366f1',
  Solar:  '#f59e0b',
  Hydro:  '#22c55e',
  Biomass:'#ef4444',
}

const STATE_COLOURS: Record<string, string> = {
  NSW: '#6366f1',
  VIC: '#3b82f6',
  QLD: '#f59e0b',
  SA:  '#ef4444',
  WA:  '#22c55e',
  TAS: '#a78bfa',
}

const VOLUNTARY_COLOURS = {
  voluntary_lgcs_k:         '#6366f1',
  corporate_ppa_lgcs_k:     '#f59e0b',
  govt_procurement_lgcs_k:  '#22c55e',
  international_offset_lgcs_k: '#ef4444',
}

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt2(n: number) { return n.toFixed(2) }
function fmt1(n: number) { return n.toFixed(1) }

// ── tooltip style ────────────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' },
  labelStyle:   { color: '#f3f4f6' },
  itemStyle:    { color: '#d1d5db' },
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── section card ─────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function RenewableEnergyCertificateXAnalytics() {
  const [data, setData]       = useState<RECSXDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getRenewableEnergyCertificateXDashboard()
      .then(d  => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Loading REC LGC/STC Market data…
    </div>
  )
  if (error || !data) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      {error ?? 'No data available'}
    </div>
  )

  const { market_prices, creation, liability, project_pipeline, voluntary_market, summary } = data

  // ── Chart 1: LGC spot price monthly 2020-2024 with volume bar overlay ──────
  const priceVolumeChart = market_prices
    .filter(p => p.certificate_type === 'LGC')
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .map(p => ({
      label:      `${p.year}-M${String(p.month).padStart(2, '0')}`,
      spot_price: p.spot_price_aud,
      fwd_price:  p.forward_price_aud,
      volume_k:   p.volume_traded_k,
    }))

  // ── Chart 2: Certificate creation by technology × year (LGCs quarterly) ────
  // Aggregate lgcs_created_k by year+technology
  const creationMap: Record<string, Record<string, number>> = {}
  for (const r of creation) {
    const key = `${r.year} ${r.quarter}`
    if (!creationMap[key]) creationMap[key] = {}
    creationMap[key][r.technology] = (creationMap[key][r.technology] ?? 0) + r.lgcs_created_k
  }
  const creationChart = Object.entries(creationMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, techs]) => ({ label, ...techs }))
  const allTechs = Array.from(new Set(creation.map(r => r.technology)))

  // ── Chart 3: Liable entity lgcs_surrendered vs shortfall_charge ──────────
  const liabilityChart = liability.map(le => ({
    name:      le.participant_name.split(' ').slice(-1)[0],
    lgcs_surr: le.lgcs_surrendered_k,
    shortfall: le.shortfall_charge_paid_m_aud,
    status:    le.compliance_status,
  }))

  // ── Chart 4: Project pipeline annual_lgcs_k by state, coloured by tech ────
  const pipelineStateMap: Record<string, Record<string, number>> = {}
  for (const p of project_pipeline) {
    if (!pipelineStateMap[p.state]) pipelineStateMap[p.state] = {}
    pipelineStateMap[p.state][p.technology] =
      (pipelineStateMap[p.state][p.technology] ?? 0) + p.annual_lgcs_k
  }
  const pipelineChart = Object.entries(pipelineStateMap).map(([state, techs]) => ({
    state,
    ...techs,
  }))
  const allPipelineTechs = Array.from(new Set(project_pipeline.map(p => p.technology)))

  // ── Chart 5: Voluntary market breakdown quarterly 2022-2024 ──────────────
  const voluntaryChart = voluntary_market
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter.localeCompare(b.quarter))
    .map(v => ({
      label:                    `${v.year} ${v.quarter}`,
      voluntary_lgcs_k:         v.voluntary_lgcs_k,
      corporate_ppa_lgcs_k:     v.corporate_ppa_lgcs_k,
      govt_procurement_lgcs_k:  v.govt_procurement_lgcs_k,
      international_offset_lgcs_k: v.international_offset_lgcs_k,
    }))

  return (
    <div className="min-h-screen bg-gray-900 p-6 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Award className="text-indigo-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">
            REC LGC/STC Market Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australian Renewable Energy Certificate market — LGC &amp; STC prices, creation, liability &amp; voluntary procurement
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          label="LGC Price (AUD)"
          value={`$${fmt2(summary.current_lgc_price_aud)}`}
          sub="Current spot"
        />
        <KPICard
          label="STC Price (AUD)"
          value={`$${fmt2(summary.current_stc_price_aud)}`}
          sub="Current spot"
        />
        <KPICard
          label="Total Accredited GW"
          value={`${summary.total_accredited_capacity_gw.toFixed(3)} GW`}
          sub="Pipeline capacity"
        />
        <KPICard
          label="Compliance Rate"
          value={`${fmt1(summary.compliance_rate_pct)}%`}
          sub="Liable entities"
        />
      </div>

      {/* Chart 1 — LGC spot price + volume */}
      <div className="mb-6">
        <SectionCard title="LGC Spot Price & Volume Traded (2020–2024)">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={priceVolumeChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                interval={5}
              />
              <YAxis yAxisId="price" orientation="left" tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: 'AUD', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
              <YAxis yAxisId="volume" orientation="right" tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: 'k certs', angle: 90, position: 'insideRight', fill: '#6b7280', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
              <Bar yAxisId="volume" dataKey="volume_k" name="Volume (k)" fill="#374151" opacity={0.6} />
              <Line yAxisId="price" type="monotone" dataKey="spot_price" name="Spot Price (AUD)" stroke="#6366f1" dot={false} strokeWidth={2} />
              <Line yAxisId="price" type="monotone" dataKey="fwd_price" name="Forward Price (AUD)" stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Chart 2 — Creation stacked bar */}
      <div className="mb-6">
        <SectionCard title="LGC Creation by Technology & Quarter (2022–2024)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={creationChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 9 }} interval={2} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: 'k LGCs', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
              {allTechs.map(tech => (
                <Bar key={tech} dataKey={tech} name={tech} stackId="a" fill={TECH_COLOURS[tech] ?? '#6366f1'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Charts 3 & 4 side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Chart 3 — Liable entity surrender vs shortfall */}
        <SectionCard title="Liable Entity: LGCs Surrendered vs Shortfall Charge">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={liabilityChart} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 9 }} width={70} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
              <Bar dataKey="lgcs_surr" name="LGCs Surrendered (k)" fill="#6366f1" />
              <Bar dataKey="shortfall" name="Shortfall Charge (M AUD)" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Chart 4 — Pipeline annual LGCs by state × technology */}
        <SectionCard title="Project Pipeline: Annual LGCs by State & Technology">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: 'k LGCs/yr', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
              {allPipelineTechs.map(tech => (
                <Bar key={tech} dataKey={tech} name={tech} stackId="a" fill={TECH_COLOURS[tech] ?? '#6366f1'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Chart 5 — Voluntary market breakdown */}
      <div className="mb-6">
        <SectionCard title="Voluntary Market Breakdown by Quarter (2022–2024)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={voluntaryChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 9 }} interval={1} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: 'k LGCs', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ color: '#d1d5db', fontSize: 12 }} />
              <Bar dataKey="voluntary_lgcs_k"         name="Voluntary LGCs"       stackId="b" fill={VOLUNTARY_COLOURS.voluntary_lgcs_k} />
              <Bar dataKey="corporate_ppa_lgcs_k"     name="Corporate PPA"        stackId="b" fill={VOLUNTARY_COLOURS.corporate_ppa_lgcs_k} />
              <Bar dataKey="govt_procurement_lgcs_k"  name="Govt Procurement"     stackId="b" fill={VOLUNTARY_COLOURS.govt_procurement_lgcs_k} />
              <Bar dataKey="international_offset_lgcs_k" name="Intl Offset"       stackId="b" fill={VOLUNTARY_COLOURS.international_offset_lgcs_k} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Summary stats footer */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
          Market Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">LGCs Created 2024</p>
            <p className="text-white font-semibold">{fmt1(summary.total_lgcs_created_2024_k)} k</p>
          </div>
          <div>
            <p className="text-gray-400">STCs Created 2024</p>
            <p className="text-white font-semibold">{fmt1(summary.total_stcs_created_2024_k)} k</p>
          </div>
          <div>
            <p className="text-gray-400">LRET 2030 Target</p>
            <p className="text-white font-semibold">{summary.lret_target_2030_twh} TWh</p>
          </div>
          <div>
            <p className="text-gray-400">Pipeline Projects</p>
            <p className="text-white font-semibold">{project_pipeline.length} projects</p>
          </div>
        </div>
      </div>
    </div>
  )
}
