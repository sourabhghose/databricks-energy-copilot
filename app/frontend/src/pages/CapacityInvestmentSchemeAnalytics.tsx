import { useEffect, useState } from 'react'
import { Award, Zap, DollarSign, Battery } from 'lucide-react'
import {
  AreaChart,
  Area,
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
} from 'recharts'
import { getCISADashboard } from '../api/client'
import type { CISADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const TECH_COLOURS: Record<string, string> = {
  ONSHORE_WIND: '#3b82f6',
  OFFSHORE_WIND: '#6366f1',
  SOLAR: '#f59e0b',
  BATTERY_2HR: '#10b981',
  BATTERY_4HR: '#14b8a6',
  PUMPED_HYDRO: '#8b5cf6',
}

const TECH_LABELS: Record<string, string> = {
  ONSHORE_WIND: 'Onshore Wind',
  OFFSHORE_WIND: 'Offshore Wind',
  SOLAR: 'Solar',
  BATTERY_2HR: 'Battery 2hr',
  BATTERY_4HR: 'Battery 4hr',
  PUMPED_HYDRO: 'Pumped Hydro',
}

const STATUS_BADGE: Record<string, string> = {
  AWARDED: 'bg-blue-900 text-blue-300',
  SHORTLISTED: 'bg-yellow-900 text-yellow-300',
  UNDER_CONSTRUCTION: 'bg-amber-900 text-amber-300',
  OPERATIONAL: 'bg-green-900 text-green-300',
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 flex items-start gap-4">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart Card wrapper
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function CapacityInvestmentSchemeAnalytics() {
  const [data, setData] = useState<CISADashboard | null>(null)

  useEffect(() => {
    getCISADashboard().then(setData).catch(console.error)
  }, [])

  if (!data) {
    return <div className="min-h-screen bg-gray-900 p-8 text-white">Loading Capacity Investment Scheme Analytics dashboard...</div>
  }

  // KPI aggregation
  const totalCapacityGW = data.contracts.reduce((s, c) => s + c.capacity_mw, 0) / 1000
  const contractsAwarded = data.contracts.filter((c) => c.status !== 'SHORTLISTED').length
  const totalInvestmentB = totalCapacityGW * 1.65 // rough AUD per GW
  const avgUnderwrite = data.contracts.reduce((s, c) => s + c.underwrite_price_aud_mwh, 0) / data.contracts.length

  // Build tender bar chart data by technology per round
  const tenderByTech = data.tenders.map((t) => {
    const roundContracts = data.contracts.filter((c) => c.tender_round === t.round_name)
    const byTech: Record<string, number> = {}
    for (const c of roundContracts) {
      byTech[c.technology] = (byTech[c.technology] || 0) + c.capacity_mw / 1000
    }
    return { round: t.round_name.replace(/_/g, ' '), ...byTech }
  })

  // Build state allocation data
  const stateMap: Record<string, Record<string, number>> = {}
  for (const c of data.contracts) {
    if (!stateMap[c.state]) stateMap[c.state] = {}
    stateMap[c.state][c.technology] = (stateMap[c.state][c.technology] || 0) + c.capacity_mw / 1000
  }
  const stateAllocation = Object.entries(stateMap).map(([state, techs]) => ({ state, ...techs }))

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Award size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold">Capacity Investment Scheme Analytics</h1>
          <p className="text-sm text-gray-400">Sprint 166b — CISA Dashboard</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Total CIS Capacity"
          value={`${totalCapacityGW.toFixed(1)} GW`}
          sub="across all tender rounds"
          icon={Zap}
          color="bg-blue-600"
        />
        <KpiCard
          title="Contracts Awarded"
          value={`${contractsAwarded}`}
          sub="awarded / under construction / operational"
          icon={Award}
          color="bg-emerald-600"
        />
        <KpiCard
          title="Total Investment"
          value={`${totalInvestmentB.toFixed(1)}B AUD`}
          sub="estimated capital commitment"
          icon={DollarSign}
          color="bg-amber-600"
        />
        <KpiCard
          title="Avg Revenue Underwrite"
          value={`$${avgUnderwrite.toFixed(1)}/MWh`}
          sub="weighted average floor price"
          icon={Battery}
          color="bg-purple-600"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* CIS Tender Results by Technology BarChart */}
        <ChartCard title="CIS Tender Results by Technology & Round (GW)">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={tenderByTech}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="round" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'GW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              {Object.entries(TECH_COLOURS).map(([tech, color]) => (
                <Bar key={tech} dataKey={tech} name={TECH_LABELS[tech]} fill={color} stackId="tech" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue Underwrite Floor vs Wholesale Price LineChart */}
        <ChartCard title="Revenue Underwrite Floor vs Wholesale Price ($/MWh)">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data.revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: '$/MWh', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="wholesale_price_aud_mwh" name="Wholesale Price" stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="underwrite_floor_aud_mwh" name="Underwrite Floor" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="cis_payment_aud_mwh" name="CIS Payment" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* State-by-State CIS Allocation Stacked BarChart */}
        <ChartCard title="State-by-State CIS Allocation (GW by Technology)">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={stateAllocation}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="state" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'GW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              {Object.entries(TECH_COLOURS).map(([tech, color]) => (
                <Bar key={tech} dataKey={tech} name={TECH_LABELS[tech]} fill={color} stackId="state" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Projected Dispatchable Capacity Additions AreaChart */}
        <ChartCard title="Projected Dispatchable Capacity Additions from CIS (2024-2030)">
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={data.projections}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} label={{ value: 'GW', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Area type="monotone" dataKey="wind_gw" name="Wind" stackId="proj" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
              <Area type="monotone" dataKey="solar_gw" name="Solar" stackId="proj" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.5} />
              <Area type="monotone" dataKey="battery_gw" name="Battery" stackId="proj" stroke="#10b981" fill="#10b981" fillOpacity={0.5} />
              <Area type="monotone" dataKey="hydro_gw" name="Hydro" stackId="proj" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table: CIS Contract Register */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">CIS Contract Register</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Developer</th>
                <th className="py-3 px-4">Technology</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4 text-right">Capacity MW</th>
                <th className="py-3 px-4 text-right">Underwrite $/MWh</th>
                <th className="py-3 px-4 text-right">COD</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Round</th>
              </tr>
            </thead>
            <tbody>
              {data.contracts.map((c) => (
                <tr key={c.project_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-white">{c.project_name}</td>
                  <td className="py-3 px-4 text-gray-300">{c.developer}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: TECH_COLOURS[c.technology] + '30', color: TECH_COLOURS[c.technology] }}>
                      {TECH_LABELS[c.technology] || c.technology}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{c.state}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{c.capacity_mw.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-300">${c.underwrite_price_aud_mwh.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{c.cod_year}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[c.status] || 'bg-gray-700 text-gray-300'}`}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{c.tender_round.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table: Tender Round Summary */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Tender Round Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-3 px-4">Round</th>
                <th className="py-3 px-4 text-right">Year</th>
                <th className="py-3 px-4 text-right">Capacity Offered GW</th>
                <th className="py-3 px-4 text-right">Bids Received</th>
                <th className="py-3 px-4 text-right">Clearing Price $/MWh</th>
                <th className="py-3 px-4 text-right">Oversubscription</th>
                <th className="py-3 px-4">Technology Focus</th>
              </tr>
            </thead>
            <tbody>
              {data.tenders.map((t) => (
                <tr key={t.round_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-white">{t.round_name.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{t.year}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{t.capacity_offered_gw.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-gray-300">{t.bids_received}</td>
                  <td className="py-3 px-4 text-right text-gray-300">${t.clearing_price_aud_mwh.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.oversubscription_ratio >= 3 ? 'bg-green-900 text-green-300' : t.oversubscription_ratio >= 2 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>
                      {t.oversubscription_ratio.toFixed(1)}x
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{t.technology_focus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
