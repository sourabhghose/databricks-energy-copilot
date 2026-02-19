import { useEffect, useState } from 'react'
import { Leaf, AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown } from 'lucide-react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api, SafeguardDashboard, SafeguardFacility, ErfProject, AccuMarketRecord } from '../api/client'

// ---------------------------------------------------------------------------
// Sector badge colours
// ---------------------------------------------------------------------------
const SECTOR_COLOURS: Record<string, string> = {
  ELECTRICITY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  MINING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  MANUFACTURING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  OIL_GAS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  TRANSPORT: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
}

const CONTRACT_COLOURS: Record<string, string> = {
  CFF: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ERF_AUCTION: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  VOLUNTARY: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
}

const STATUS_COLOURS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  label,
  value,
  sub,
  colour,
}: {
  label: string
  value: string
  sub?: string
  colour?: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${colour ?? 'text-gray-900 dark:text-white'}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500 dark:text-gray-400">{sub}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ACCU Price & Volume Chart
// ---------------------------------------------------------------------------
function AccuPriceChart({ data }: { data: AccuMarketRecord[] }) {
  if (!data.length) return null
  const chartData = data.map(r => ({
    month: r.date.slice(0, 7),
    spot: r.spot_price_aud,
    forward: r.forward_price_aud,
    volume: Math.round(r.volume_traded / 1000),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        ACCU Spot vs Forward Price (2025) with Volume
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="price" domain={['auto', 'auto']} tick={{ fontSize: 11 }} label={{ value: '$/t', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11 }} />
          <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Volume (k)', angle: 90, position: 'insideRight', offset: 8, fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value: number, name: string) => {
              if (name === 'volume') return [`${value.toLocaleString()}k`, 'Volume']
              return [`$${value.toFixed(2)}`, name === 'spot' ? 'Spot $/t' : 'Forward $/t']
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="vol" dataKey="volume" name="Volume (k units)" fill="#d1d5db" opacity={0.6} radius={[2, 2, 0, 0]} />
          <Line yAxisId="price" type="monotone" dataKey="spot" name="Spot $/t" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="price" type="monotone" dataKey="forward" name="Forward $/t" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compliance badge
// ---------------------------------------------------------------------------
function ComplianceBadge({ status }: { status: string }) {
  if (status === 'COMPLIANT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle size={11} />
        Compliant
      </span>
    )
  }
  if (status === 'EXCESS_EMISSIONS') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <AlertTriangle size={11} />
        Excess
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
      <XCircle size={11} />
      Non-Compliant
    </span>
  )
}

// ---------------------------------------------------------------------------
// Facilities Table
// ---------------------------------------------------------------------------
const ALL_SECTORS = ['ALL', 'ELECTRICITY', 'MINING', 'MANUFACTURING', 'OIL_GAS', 'TRANSPORT']
const ALL_STATES = ['ALL', 'NSW', 'QLD', 'VIC', 'SA', 'WA', 'TAS', 'NT']

function FacilitiesTable({ facilities }: { facilities: SafeguardFacility[] }) {
  const [sector, setSector] = useState('ALL')
  const [state, setState] = useState('ALL')

  const filtered = facilities.filter(f => {
    if (sector !== 'ALL' && f.sector !== sector) return false
    if (state !== 'ALL' && f.state !== state) return false
    return true
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Covered Facilities ({filtered.length})
        </h3>
        <div className="flex gap-2 flex-wrap">
          <select
            value={sector}
            onChange={e => setSector(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {ALL_SECTORS.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Sectors' : s.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={state}
            onChange={e => setState(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
          >
            {ALL_STATES.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Facility</th>
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Operator</th>
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Sector</th>
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">State</th>
              <th className="text-right py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Baseline kt</th>
              <th className="text-right py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Actual kt</th>
              <th className="text-right py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Above/Below kt</th>
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Compliance</th>
              <th className="text-right py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Decline %</th>
              <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">ACCU Purchased</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.facility_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-200">{f.facility_name}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{f.operator}</td>
                <td className="py-2 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${SECTOR_COLOURS[f.sector] ?? ''}`}>
                    {f.sector.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{f.state}</td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{f.baseline_co2e_kt.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{f.actual_emissions_co2e_kt.toLocaleString()}</td>
                <td className={`py-2 pr-3 text-right font-medium ${f.emissions_above_below_kt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {f.emissions_above_below_kt > 0 ? '+' : ''}{f.emissions_above_below_kt.toFixed(1)}
                  {f.emissions_above_below_kt > 0
                    ? <TrendingUp size={11} className="inline ml-1" />
                    : <TrendingDown size={11} className="inline ml-1" />
                  }
                </td>
                <td className="py-2 pr-3">
                  <ComplianceBadge status={f.compliance_status} />
                </td>
                <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-400">{f.decline_rate_pct.toFixed(2)}%</td>
                <td className="py-2 text-right text-gray-700 dark:text-gray-300">{f.purchased_accu.toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-gray-400 dark:text-gray-500">No facilities match the selected filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ERF Projects Table
// ---------------------------------------------------------------------------
const ALL_METHODOLOGIES = [
  'ALL',
  'Avoided Deforestation',
  'Landfill Gas Capture',
  'Savanna Fire Management',
  'Industrial Fugitive Emissions',
  'Reforestation',
  'Soil Carbon',
  'Industrial Energy Efficiency',
]

function ErfProjectsTable({ projects }: { projects: ErfProject[] }) {
  const [methodology, setMethodology] = useState('ALL')

  const filtered = projects.filter(p => methodology === 'ALL' || p.methodology === methodology)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          ERF Projects ({filtered.length})
        </h3>
        <select
          value={methodology}
          onChange={e => setMethodology(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          {ALL_METHODOLOGIES.map(m => (
            <option key={m} value={m}>{m === 'ALL' ? 'All Methodologies' : m}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Project</th>
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Developer</th>
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">State</th>
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Methodology</th>
              <th className="text-right py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Abatement kt</th>
              <th className="text-right py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">ACCU Issued</th>
              <th className="text-right py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Price $/cert</th>
              <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Contract Type</th>
              <th className="text-right py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Value $M</th>
              <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.project_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-200">{p.project_name}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{p.developer}</td>
                <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{p.state}</td>
                <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{p.methodology}</td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{p.abatement_kt_co2e.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{p.accu_issued.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">${p.accu_price_aud.toFixed(2)}</td>
                <td className="py-2 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${CONTRACT_COLOURS[p.contract_type] ?? ''}`}>
                    {p.contract_type.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">${p.contract_value_m_aud.toFixed(2)}M</td>
                <td className="py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[p.status] ?? ''}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-gray-400 dark:text-gray-500">No projects match the selected filter</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function SafeguardAnalytics() {
  const [dashboard, setDashboard] = useState<SafeguardDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getSafeguardDashboard()
      .then(data => {
        setDashboard(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err?.message ?? 'Failed to load Safeguard dashboard')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 dark:text-gray-500 text-sm animate-pulse">Loading Safeguard & ERF data...</div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 text-sm">{error ?? 'No data available'}</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Leaf className="text-green-600 dark:text-green-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Safeguard Mechanism &amp; ERF Analytics
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Australian Carbon Credit Units (ACCU) &bull; Emissions Reduction Fund &bull; Clean Energy Regulator
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-green-600 text-white shadow">
            <Leaf size={14} />
            ACCU ${dashboard.accu_spot_price_aud.toFixed(2)}/t
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {new Date(dashboard.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Context note */}
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40 rounded-lg px-4 py-3 text-xs text-green-800 dark:text-green-300">
        <strong>Safeguard Mechanism (reformed 2023):</strong> Requires approximately 215 of Australia's largest industrial emitters to reduce emissions at ~4.9%/year. Facilities that exceed their baseline must surrender ACCUs (Australian Carbon Credit Units) or Safeguard Mechanism Credits (SMCs). The ERF (Emissions Reduction Fund) provides government funding for abatement projects that generate ACCUs.
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Covered Facilities"
          value={dashboard.total_covered_facilities.toString()}
          sub="~215 nationally covered"
        />
        <KpiCard
          label="Total Baseline Emissions"
          value={`${dashboard.total_baseline_emissions_mt.toFixed(1)} Mt`}
          sub="CO\u2082e (sample subset)"
          colour="text-blue-700 dark:text-blue-400"
        />
        <KpiCard
          label="Total Actual Emissions"
          value={`${dashboard.total_actual_emissions_mt.toFixed(1)} Mt`}
          sub={`${dashboard.total_exceedances_mt.toFixed(2)} Mt exceedance`}
          colour={dashboard.total_actual_emissions_mt > dashboard.total_baseline_emissions_mt
            ? 'text-red-600 dark:text-red-400'
            : 'text-green-600 dark:text-green-400'}
        />
        <KpiCard
          label="ACCU Spot Price"
          value={`$${dashboard.accu_spot_price_aud.toFixed(2)}/t`}
          sub="Australian Carbon Credit Unit"
          colour="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* ACCU Price Chart */}
      <AccuPriceChart data={dashboard.accu_market} />

      {/* Facilities Table */}
      <FacilitiesTable facilities={dashboard.facilities} />

      {/* ERF Projects Table */}
      <ErfProjectsTable projects={dashboard.erf_projects} />

      {/* Footer */}
      <div className="text-xs text-gray-400 dark:text-gray-600 text-center pb-2">
        Data sourced from Clean Energy Regulator (CER) &bull; ACCU prices indicative &bull; Reporting year 2025
      </div>
    </div>
  )
}
