import { useEffect, useState } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getRooftopSolarGridDashboard,
  RGADashboard,
  RGAAdoptionRecord,
  RGAGenerationRecord,
  RGADuckCurveRecord,
  RGAHostingCapacityRecord,
  RGAExportManagementRecord,
} from '../api/client'

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const STATE_COLORS: Record<string, string> = {
  NSW: '#60a5fa',
  VIC: '#34d399',
  QLD: '#fbbf24',
  SA:  '#f87171',
  WA:  '#a78bfa',
}

const YEAR_COLORS = {
  net_demand_2020_mw: '#94a3b8',
  net_demand_2024_mw: '#60a5fa',
  net_demand_2030_mw: '#fbbf24',
  net_demand_2035_mw: '#f87171',
}

const SCHEME_COLOR: Record<string, string> = {
  ZERO_EXPORT:       '#ef4444',
  STATIC_LIMIT_1KW:  '#f97316',
  STATIC_LIMIT_5KW:  '#eab308',
  DYNAMIC_EXPORT:    '#22c55e',
  UNLIMITED:         '#3b82f6',
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  label: string
  value: string
  sub?: string
  accent?: string
}
function KpiCard({ label, value, sub, accent = '#60a5fa' }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-1 border border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <h2 className="text-base font-semibold text-gray-100 mb-4">{title}</h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Adoption Trends — LineChart: penetration by state across quarters
// ---------------------------------------------------------------------------
function AdoptionTrends({ adoption }: { adoption: RGAAdoptionRecord[] }) {
  const states = [...new Set(adoption.map(r => r.state))]
  const quarters = [...new Set(adoption.map(r => r.quarter))]

  const chartData = quarters.map(q => {
    const row: Record<string, string | number> = { quarter: q }
    states.forEach(s => {
      const rec = adoption.find(r => r.state === s && r.quarter === q)
      if (rec) row[s] = rec.penetration_pct
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        {states.map(s => (
          <Line
            key={s}
            type="monotone"
            dataKey={s}
            stroke={STATE_COLORS[s] ?? '#60a5fa'}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Adoption Capacity bars — total capacity MW by state/quarter
// ---------------------------------------------------------------------------
function AdoptionCapacity({ adoption }: { adoption: RGAAdoptionRecord[] }) {
  const states = [...new Set(adoption.map(r => r.state))]
  const quarters = [...new Set(adoption.map(r => r.quarter))]

  const chartData = quarters.map(q => {
    const row: Record<string, string | number> = { quarter: q }
    states.forEach(s => {
      const rec = adoption.find(r => r.state === s && r.quarter === q)
      if (rec) row[s] = rec.total_capacity_mw
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="quarter" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          formatter={(v: number) => [`${v.toFixed(0)} MW`, '']}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        {states.map(s => (
          <Bar key={s} dataKey={s} stackId="a" fill={STATE_COLORS[s] ?? '#60a5fa'} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Generation Profile — AreaChart: 24hr solar vs demand for a selected region
// ---------------------------------------------------------------------------
function GenerationProfile({
  generation,
  selectedRegion,
  onRegionChange,
}: {
  generation: RGAGenerationRecord[]
  selectedRegion: string
  onRegionChange: (r: string) => void
}) {
  const regions = [...new Set(generation.map(r => r.region))]
  const filtered = generation
    .filter(r => r.region === selectedRegion)
    .sort((a, b) => a.hour - b.hour)

  const chartData = filtered.map(r => ({
    hour: `${String(r.hour).padStart(2, '0')}:00`,
    'System Demand': r.system_demand_mw,
    'Rooftop Solar': r.rooftop_generation_mw,
    'Net Export': r.net_export_to_grid_mw,
    'Behind-Meter': r.behind_meter_consumption_mw,
  }))

  return (
    <>
      <div className="flex gap-2 mb-3">
        {regions.map(r => (
          <button
            key={r}
            onClick={() => onRegionChange(r)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              r === selectedRegion
                ? 'text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            style={r === selectedRegion ? { background: STATE_COLORS[r] ?? '#60a5fa' } : {}}
          >
            {r}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="gradDemand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="gradSolar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(v: number) => [`${v.toFixed(0)} MW`, '']}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="System Demand"
            stroke="#60a5fa"
            fill="url(#gradDemand)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Rooftop Solar"
            stroke="#fbbf24"
            fill="url(#gradSolar)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Behind-Meter"
            stroke="#34d399"
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <Area
            type="monotone"
            dataKey="Net Export"
            stroke="#a78bfa"
            fill="none"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </>
  )
}

// ---------------------------------------------------------------------------
// Duck Curve Evolution — LineChart: net demand by year for a region + season
// ---------------------------------------------------------------------------
function DuckCurveEvolution({
  duckCurve,
  selectedRegion,
  selectedSeason,
  onRegionChange,
  onSeasonChange,
}: {
  duckCurve: RGADuckCurveRecord[]
  selectedRegion: string
  selectedSeason: string
  onRegionChange: (r: string) => void
  onSeasonChange: (s: string) => void
}) {
  const regions = [...new Set(duckCurve.map(r => r.region))]
  const seasons = [...new Set(duckCurve.map(r => r.season))]

  const filtered = duckCurve
    .filter(r => r.region === selectedRegion && r.season === selectedSeason)
    .sort((a, b) => a.hour - b.hour)

  const chartData = filtered.map(r => ({
    hour: `${String(r.hour).padStart(2, '0')}:00`,
    '2020': r.net_demand_2020_mw,
    '2024': r.net_demand_2024_mw,
    '2030': r.net_demand_2030_mw,
    '2035': r.net_demand_2035_mw,
  }))

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        {regions.map(r => (
          <button
            key={r}
            onClick={() => onRegionChange(r)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              r === selectedRegion
                ? 'text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            style={r === selectedRegion ? { background: STATE_COLORS[r] ?? '#60a5fa' } : {}}
          >
            {r}
          </button>
        ))}
        <span className="self-center text-gray-600">|</span>
        {seasons.map(s => (
          <button
            key={s}
            onClick={() => onSeasonChange(s)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              s === selectedSeason
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" MW" domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#f3f4f6' }}
            formatter={(v: number) => [`${v.toFixed(0)} MW`, '']}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
          {(['2020', '2024', '2030', '2035'] as const).map(yr => (
            <Line
              key={yr}
              type="monotone"
              dataKey={yr}
              stroke={YEAR_COLORS[`net_demand_${yr}_mw` as keyof typeof YEAR_COLORS]}
              strokeWidth={yr === '2024' ? 2.5 : 1.5}
              strokeDasharray={yr === '2030' ? '6 3' : yr === '2035' ? '3 3' : undefined}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  )
}

// ---------------------------------------------------------------------------
// Hosting Capacity Table
// ---------------------------------------------------------------------------
const CONSTRAINT_BADGE: Record<string, string> = {
  VOLTAGE:    'bg-yellow-900 text-yellow-300',
  THERMAL:    'bg-orange-900 text-orange-300',
  PROTECTION: 'bg-red-900 text-red-300',
}

function HostingCapacityTable({ records }: { records: RGAHostingCapacityRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <th className="pb-2 pr-4">Distributor</th>
            <th className="pb-2 pr-4">Feeder Class</th>
            <th className="pb-2 pr-4 text-right">% Feeders Over Limit</th>
            <th className="pb-2 pr-4 text-right">Add. Capacity (MW)</th>
            <th className="pb-2 pr-4">Constraint</th>
            <th className="pb-2 pr-4">Dynamic Export</th>
            <th className="pb-2 text-right">Upgrade $/MW (M)</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr
              key={i}
              className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
            >
              <td className="py-2 pr-4 text-gray-200 font-medium">{r.distributor}</td>
              <td className="py-2 pr-4 text-gray-300 text-xs">{r.feeder_class.replace(/_/g, ' ')}</td>
              <td className="py-2 pr-4 text-right">
                <span
                  className={`font-semibold ${
                    r.avg_hosting_capacity_pct > 35
                      ? 'text-red-400'
                      : r.avg_hosting_capacity_pct > 20
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}
                >
                  {r.avg_hosting_capacity_pct.toFixed(1)}%
                </span>
              </td>
              <td className="py-2 pr-4 text-right text-gray-300">
                {r.additional_capacity_available_mw.toFixed(0)}
              </td>
              <td className="py-2 pr-4">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    CONSTRAINT_BADGE[r.constraint_type] ?? 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {r.constraint_type}
                </span>
              </td>
              <td className="py-2 pr-4">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    r.dynamic_export_limit_applied
                      ? 'bg-green-900 text-green-300'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {r.dynamic_export_limit_applied ? 'Yes' : 'No'}
                </span>
              </td>
              <td className="py-2 text-right text-gray-300">${r.upgrade_cost_per_mw_m.toFixed(2)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export Management Schemes — BarChart: avg curtailment & satisfaction by scheme
// ---------------------------------------------------------------------------
function ExportManagementChart({ records }: { records: RGAExportManagementRecord[] }) {
  // Aggregate by scheme: avg curtailment and avg satisfaction
  const schemeMap: Record<string, { curt: number[]; sat: number[]; benefit: number[] }> = {}
  records.forEach(r => {
    if (!schemeMap[r.scheme]) schemeMap[r.scheme] = { curt: [], sat: [], benefit: [] }
    schemeMap[r.scheme].curt.push(r.avg_curtailment_pct)
    schemeMap[r.scheme].sat.push(r.customer_satisfaction_score)
    schemeMap[r.scheme].benefit.push(r.network_benefit_m_yr)
  })

  const chartData = Object.entries(schemeMap).map(([scheme, vals]) => ({
    scheme: scheme.replace(/_/g, ' '),
    'Avg Curtailment %': parseFloat(
      (vals.curt.reduce((a, b) => a + b, 0) / vals.curt.length).toFixed(2)
    ),
    'Satisfaction (×5)': parseFloat(
      ((vals.sat.reduce((a, b) => a + b, 0) / vals.sat.length) * 5).toFixed(2)
    ),
    'Network Benefit $M/yr': parseFloat(
      (vals.benefit.reduce((a, b) => a + b, 0) / vals.benefit.length).toFixed(1)
    ),
    fill: SCHEME_COLOR[scheme] ?? '#60a5fa',
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="scheme"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          angle={-20}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Bar dataKey="Avg Curtailment %" fill="#f87171" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Satisfaction (×5)" fill="#34d399" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Network Benefit $M/yr" fill="#60a5fa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Export Management Penetration — BarChart: penetration % by scheme per state
// ---------------------------------------------------------------------------
function ExportPenetrationChart({ records }: { records: RGAExportManagementRecord[] }) {
  const states = [...new Set(records.map(r => r.state))]
  const schemes = [...new Set(records.map(r => r.scheme))]

  const chartData = states.map(st => {
    const row: Record<string, string | number> = { state: st }
    schemes.forEach(sc => {
      const rec = records.find(r => r.state === st && r.scheme === sc)
      row[sc.replace(/_/g, ' ')] = rec ? rec.penetration_pct : 0
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="state" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6' }}
          formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        {schemes.map(sc => (
          <Bar
            key={sc}
            dataKey={sc.replace(/_/g, ' ')}
            stackId="a"
            fill={SCHEME_COLOR[sc] ?? '#60a5fa'}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function RooftopSolarGridAnalytics() {
  const [data, setData] = useState<RGADashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [genRegion, setGenRegion] = useState('NSW')
  const [dcRegion, setDcRegion] = useState('NSW')
  const [dcSeason, setDcSeason] = useState('SUMMER')

  useEffect(() => {
    getRooftopSolarGridDashboard()
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading Rooftop Solar Grid Analytics...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-sm">Error: {error ?? 'No data returned'}</div>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">
          Rooftop Solar Adoption &amp; Grid Integration Analytics
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Sprint 77a — Export management, duck curve evolution, hosting capacity constraints &amp; penetration trends
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <KpiCard
          label="Total Rooftop (2024)"
          value={`${((summary.total_rooftop_mw_2024 as number) / 1000).toFixed(1)} GW`}
          sub="Installed capacity"
          accent="#fbbf24"
        />
        <KpiCard
          label="Total Systems (2024)"
          value={`${((summary.total_systems_2024 as number) / 1_000_000).toFixed(2)}M`}
          sub="Rooftop installations"
          accent="#60a5fa"
        />
        <KpiCard
          label="Avg Penetration"
          value={`${summary.avg_penetration_pct}%`}
          sub="% of premises with solar"
          accent="#34d399"
        />
        <KpiCard
          label="Peak Curtailment"
          value={`${summary.peak_curtailment_pct}%`}
          sub="Solar curtailment at peak"
          accent="#f87171"
        />
        <KpiCard
          label="Min Net Demand 2024"
          value={`${((summary.min_net_demand_2024_mw as number) / 1000).toFixed(1)} GW`}
          sub="Midday trough"
          accent="#a78bfa"
        />
        <KpiCard
          label="Min Net Demand 2030"
          value={`${((summary.min_net_demand_2030_mw as number) / 1000).toFixed(1)} GW`}
          sub="Projected midday trough"
          accent="#f97316"
        />
        <KpiCard
          label="Avg Payback"
          value={`${summary.avg_payback_years} yrs`}
          sub="Residential systems"
          accent="#22d3ee"
        />
      </div>

      {/* Adoption Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Section title="Solar Penetration by State (% of Premises)">
          <AdoptionTrends adoption={data.adoption} />
        </Section>
        <Section title="Installed Capacity Growth by State (MW)">
          <AdoptionCapacity adoption={data.adoption} />
        </Section>
      </div>

      {/* Generation Profile */}
      <div className="mb-4">
        <Section title="Summer Peak Day Generation Profile — Solar vs Demand (24-Hour)">
          <GenerationProfile
            generation={data.generation}
            selectedRegion={genRegion}
            onRegionChange={setGenRegion}
          />
        </Section>
      </div>

      {/* Duck Curve */}
      <div className="mb-4">
        <Section title="Duck Curve Evolution — Net Demand by Year (Key Hours)">
          <DuckCurveEvolution
            duckCurve={data.duck_curve}
            selectedRegion={dcRegion}
            selectedSeason={dcSeason}
            onRegionChange={setDcRegion}
            onSeasonChange={setDcSeason}
          />
        </Section>
      </div>

      {/* Hosting Capacity */}
      <div className="mb-4">
        <Section title="Hosting Capacity Constraints by Distributor & Feeder Class">
          <HostingCapacityTable records={data.hosting_capacity} />
        </Section>
      </div>

      {/* Export Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Section title="Export Scheme: Avg Curtailment, Satisfaction & Network Benefit">
          <ExportManagementChart records={data.export_management} />
        </Section>
        <Section title="Export Scheme Penetration by State (% of Systems)">
          <ExportPenetrationChart records={data.export_management} />
        </Section>
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-600 text-center mt-4">
        Sprint 77a — Rooftop Solar Grid Analytics (RGA) | Data: Synthetic mock | 2024
      </p>
    </div>
  )
}
