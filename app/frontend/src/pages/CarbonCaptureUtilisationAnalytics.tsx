import { useEffect, useState } from 'react'
import { Cloud, DollarSign, Activity, Database, CheckCircle } from 'lucide-react'
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
  getCarbonCaptureUtilisationDashboard,
  CCUSDashboard,
} from '../api/client'

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
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

// ── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

const STATUS_COLOURS: Record<string, string> = {
  Operating:           '#10b981',
  'Under Construction': '#3b82f6',
  FEED:                '#f59e0b',
  Feasibility:         '#a78bfa',
  Proposed:            '#6b7280',
}

const TECH_COLOURS: Record<string, string> = {
  'Post-combustion': '#3b82f6',
  'Pre-combustion':  '#10b981',
  'Oxy-fuel':        '#f59e0b',
  DAC:               '#a78bfa',
  BECCS:             '#06b6d4',
}

export default function CarbonCaptureUtilisationAnalytics() {
  const [data, setData] = useState<CCUSDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCarbonCaptureUtilisationDashboard()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading CCUS dashboard...
      </div>
    )
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error ?? 'No data'}
      </div>
    )

  const { projects, capture_performance, storage_monitoring, cost_curves, policy_instruments, summary } = data

  // ── Chart 1: capture capacity by project (coloured by status) ─────────────
  const capacityChartData = projects.map((p) => ({
    name: p.project_name.length > 18 ? p.project_name.slice(0, 18) + '…' : p.project_name,
    capacity: p.capture_capacity_mtpa,
    status: p.status,
  }))

  // ── Chart 2: quarterly CO2 captured for operating projects ─────────────────
  const operatingIds = projects
    .filter((p) => p.status === 'Operating')
    .map((p) => p.project_id)

  // Build a map of "year-Q" → { label, [projectId]: value }
  const quarterMap: Record<string, Record<string, number | string>> = {}
  capture_performance
    .filter((cp) => operatingIds.includes(cp.project_id))
    .forEach((cp) => {
      const key = `${cp.year}-Q${cp.quarter}`
      if (!quarterMap[key]) quarterMap[key] = { label: key }
      quarterMap[key][cp.project_id] = (Number(quarterMap[key][cp.project_id] ?? 0)) + cp.co2_captured_kt
    })
  const quarterlyChartData = Object.values(quarterMap).slice(-20)

  // ── Chart 3: cost breakdown by technology (2024) ────────────────────────────
  const techMap: Record<string, { capture: number; transport: number; storage: number; count: number }> = {}
  cost_curves
    .filter((cc) => cc.year === 2024)
    .forEach((cc) => {
      if (!techMap[cc.technology])
        techMap[cc.technology] = { capture: 0, transport: 0, storage: 0, count: 0 }
      techMap[cc.technology].capture  += cc.capture_cost_aud_tco2
      techMap[cc.technology].transport += cc.transport_cost_aud_tco2
      techMap[cc.technology].storage  += cc.storage_cost_aud_tco2
      techMap[cc.technology].count    += 1
    })
  const costChartData = Object.entries(techMap).map(([tech, vals]) => ({
    technology: tech,
    Capture:   Math.round(vals.capture / vals.count),
    Transport: Math.round(vals.transport / vals.count),
    Storage:   Math.round(vals.storage / vals.count),
  }))

  // ── Chart 4: annual_support_m by instrument (averaged across jurisdictions) ─
  const instrMap: Record<string, { total: number; count: number }> = {}
  policy_instruments.forEach((pi) => {
    if (!instrMap[pi.instrument]) instrMap[pi.instrument] = { total: 0, count: 0 }
    instrMap[pi.instrument].total += pi.annual_support_m
    instrMap[pi.instrument].count += 1
  })
  const policyChartData = Object.entries(instrMap).map(([instrument, vals]) => ({
    instrument: instrument.length > 20 ? instrument.slice(0, 20) + '…' : instrument,
    avg_support: Math.round(vals.total / vals.count),
  }))

  // ── Chart 5: total_capacity_mt vs injected_to_date_mt per storage site ──────
  const storageChartData = storage_monitoring.map((s) => ({
    site: s.site_name.length > 22 ? s.site_name.slice(0, 22) + '…' : s.site_name,
    'Total Capacity (Mt)': s.total_capacity_mt,
    'Injected to Date (Mt)': s.injected_to_date_mt,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <Cloud size={28} className="text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">
            Carbon Capture Utilisation &amp; Storage Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Australian CCUS project pipeline, capture performance, storage monitoring and cost curves
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Capture Capacity"
          value={`${summary.total_capture_capacity_mtpa.toFixed(2)} Mtpa`}
          sub="Across all projects"
          icon={Cloud}
          colour="bg-cyan-600"
        />
        <KpiCard
          label="Total Captured to Date"
          value={`${summary.total_captured_to_date_mt.toFixed(2)} Mt`}
          sub="Operating projects"
          icon={Activity}
          colour="bg-teal-600"
        />
        <KpiCard
          label="Avg Capture Cost"
          value={`$${summary.avg_capture_cost_aud_tco2.toFixed(0)}/tCO2`}
          sub="2024 cost curves"
          icon={DollarSign}
          colour="bg-amber-600"
        />
        <KpiCard
          label="Operating Projects"
          value={String(summary.operating_projects)}
          sub="Currently injecting CO2"
          icon={CheckCircle}
          colour="bg-green-600"
        />
        <KpiCard
          label="Total Storage Capacity"
          value={`${summary.total_storage_capacity_mt.toFixed(0)} Mt`}
          sub="Across monitored sites"
          icon={Database}
          colour="bg-violet-600"
        />
      </div>

      {/* Chart 1: Capture Capacity by Project */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Capture Capacity by Project"
          subtitle="Million tonnes CO2 per year — coloured by project status"
        />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={capacityChartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" Mtpa" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar dataKey="capacity" name="Capture Capacity (Mtpa)" radius={[4, 4, 0, 0]}>
              {capacityChartData.map((entry, idx) => (
                <Cell key={idx} fill={STATUS_COLOURS[entry.status] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: colour }} />
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Chart 2: Quarterly CO2 Captured for Operating Projects */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Quarterly CO2 Captured — Operating Projects"
          subtitle="Thousand tonnes CO2 captured per quarter"
        />
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={quarterlyChartData} margin={{ top: 4, right: 16, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={3}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" kt" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
            {operatingIds.map((pid, idx) => {
              const proj = projects.find((p) => p.project_id === pid)
              const colours = ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa']
              return (
                <Line
                  key={pid}
                  type="monotone"
                  dataKey={pid}
                  name={proj?.project_name ?? pid}
                  stroke={colours[idx % colours.length]}
                  strokeWidth={2}
                  dot={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 3: Cost Breakdown by Technology (2024) */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Cost Breakdown by Technology (2024)"
          subtitle="Average AUD/tCO2 — capture, transport and storage components"
        />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={costChartData} margin={{ top: 4, right: 16, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="technology"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $/t" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Capture"   stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Transport" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Storage"   stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 4: Policy Support by Instrument */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Annual Policy Support by Instrument"
          subtitle="Average AUD million per year — averaged across jurisdictions"
        />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={policyChartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="instrument"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" $M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Bar
              dataKey="avg_support"
              name="Avg Annual Support ($M)"
              radius={[4, 4, 0, 0]}
            >
              {policyChartData.map((_, idx) => {
                const palette = ['#3b82f6', '#10b981', '#f59e0b', '#a78bfa', '#06b6d4']
                return <Cell key={idx} fill={palette[idx % palette.length]} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 5: Storage Site Capacity vs Injected */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader
          title="Storage Site Capacity vs Injected to Date"
          subtitle="Million tonnes CO2 — total capacity vs actual injection"
        />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={storageChartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="site"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" Mt" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
              labelStyle={{ color: '#f9fafb' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Total Capacity (Mt)"    fill="#6b7280" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Injected to Date (Mt)"  fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary detail grid */}
      <div className="bg-gray-800 rounded-xl p-5 shadow">
        <SectionHeader title="CCUS Project Summary" subtitle="All projects in the Australian pipeline" />
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.project_id} className="bg-gray-700 rounded-lg p-4 space-y-1">
              <dt className="text-sm font-semibold text-white">{p.project_name}</dt>
              <dd className="text-xs text-gray-300">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-white text-xs font-medium mr-2"
                  style={{ backgroundColor: STATUS_COLOURS[p.status] ?? '#6b7280' }}
                >
                  {p.status}
                </span>
                {p.state} · {p.sector}
              </dd>
              <dd className="text-xs text-gray-400">
                Technology: <span className="text-gray-200">{p.technology}</span>
              </dd>
              <dd className="text-xs text-gray-400">
                Capacity:{' '}
                <span className="text-gray-200">{p.capture_capacity_mtpa} Mtpa</span>
              </dd>
              <dd className="text-xs text-gray-400">
                Storage: <span className="text-gray-200">{p.storage_type}</span>
              </dd>
              <dd className="text-xs text-gray-400">
                CAPEX: <span className="text-gray-200">${p.capex_b_aud.toFixed(2)}B AUD</span>
                &nbsp;|&nbsp; OPEX:{' '}
                <span className="text-gray-200">${p.opex_m_pa.toFixed(1)}M pa</span>
              </dd>
              <dd className="text-xs text-gray-400">
                Operator: <span className="text-gray-200">{p.operator}</span>
                &nbsp;|&nbsp; Commissioning:{' '}
                <span className="text-gray-200">{p.commissioning_year}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Storage Monitoring Table */}
      <div className="bg-gray-800 rounded-xl p-5 shadow overflow-x-auto">
        <SectionHeader
          title="Storage Site Monitoring"
          subtitle="Integrity status, injection rates and plume extents"
        />
        <table className="w-full text-sm text-left text-gray-300">
          <thead>
            <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
              <th className="py-2 pr-4">Site</th>
              <th className="py-2 pr-4">State</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Capacity (Mt)</th>
              <th className="py-2 pr-4">Injected (Mt)</th>
              <th className="py-2 pr-4">Rate (Mt/pa)</th>
              <th className="py-2 pr-4">Wells</th>
              <th className="py-2 pr-4">Plume (km²)</th>
              <th className="py-2">Integrity</th>
            </tr>
          </thead>
          <tbody>
            {storage_monitoring.map((s) => (
              <tr key={s.storage_site_id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-2 pr-4 font-medium text-white">{s.site_name}</td>
                <td className="py-2 pr-4">{s.state}</td>
                <td className="py-2 pr-4 text-xs">{s.storage_type}</td>
                <td className="py-2 pr-4">{s.total_capacity_mt.toLocaleString()}</td>
                <td className="py-2 pr-4">{s.injected_to_date_mt}</td>
                <td className="py-2 pr-4">{s.injection_rate_mt_pa}</td>
                <td className="py-2 pr-4">{s.monitoring_wells}</td>
                <td className="py-2 pr-4">{s.plume_area_km2}</td>
                <td className="py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      s.integrity_status === 'Secure'
                        ? 'bg-green-800 text-green-300'
                        : s.integrity_status === 'Minor Anomaly'
                        ? 'bg-yellow-800 text-yellow-300'
                        : 'bg-blue-800 text-blue-300'
                    }`}
                  >
                    {s.integrity_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
