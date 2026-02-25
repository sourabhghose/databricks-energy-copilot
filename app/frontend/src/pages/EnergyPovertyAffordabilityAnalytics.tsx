import { useEffect, useState } from 'react'
import { Heart, Zap, AlertTriangle, Users } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getEPAADashboard } from '../api/client'
import type { EPAADashboard } from '../api/client'

// ---------------------------------------------------------------------------
// Colour palettes
// ---------------------------------------------------------------------------
const STATE_COLOURS: Record<string, string> = {
  NSW: '#3b82f6',
  VIC: '#f59e0b',
  QLD: '#ef4444',
  SA: '#10b981',
  WA: '#8b5cf6',
  TAS: '#06b6d4',
  NT: '#f97316',
  ACT: '#ec4899',
}

const HARDSHIP_COLOURS: Record<string, string> = {
  payment_plan: '#3b82f6',
  debt_waiver: '#f59e0b',
  appliance_replacement: '#10b981',
  energy_audit: '#8b5cf6',
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
export default function EnergyPovertyAffordabilityAnalytics() {
  const [data, setData] = useState<EPAADashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEPAADashboard()
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400">Error: {error}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Loading Energy Poverty &amp; Affordability Analytics...</p>
      </div>
    )
  }

  // ---- Derived KPIs ----
  const avgPovertyRate =
    data.states.reduce((s, r) => s + r.energy_poverty_rate_pct, 0) / data.states.length
  const avgBill =
    data.states.reduce((s, r) => s + r.avg_annual_bill_aud, 0) / data.states.length
  const latestYearDisc = data.disconnections.filter(
    (d) => d.year === Math.max(...data.disconnections.map((x) => x.year)),
  )
  const avgDisconnections =
    latestYearDisc.reduce((s, r) => s + r.disconnections_per_10k, 0) / (latestYearDisc.length || 1)
  const totalHardship = data.states.reduce((s, r) => s + r.hardship_participants_k, 0)

  // ---- Bar chart: Energy burden by income quintile ----
  const burdenByQuintile = data.income_quintiles.map((q) => ({
    quintile: q.quintile.replace('_', ' '),
    energy_burden_pct: q.energy_burden_pct,
    energy_poverty_rate_pct: q.energy_poverty_rate_pct,
  }))

  // ---- Line chart: Disconnection rates by state over years ----
  const discYears = [...new Set(data.disconnections.map((d) => d.year))].sort()
  const discByYear = discYears.map((yr) => {
    const row: Record<string, number | string> = { year: yr.toString() }
    data.disconnections
      .filter((d) => d.year === yr)
      .forEach((d) => {
        row[d.state] = d.disconnections_per_10k
      })
    return row
  })
  const discStates = [...new Set(data.disconnections.map((d) => d.state))]

  // ---- Stacked bar: Hardship outcomes by retailer ----
  const hardshipByRetailer = data.retailer_hardship.map((r) => ({
    retailer: r.retailer_name,
    payment_plan: r.payment_plan_count_k,
    debt_waiver: r.debt_waivers_k,
    appliance_replacement: r.appliance_replacements,
    energy_audit: r.energy_audits,
  }))

  // ---- Scatter: Energy poverty rate vs median income by LGA ----
  const lgaScatter = data.lga_data.map((l) => ({
    name: l.lga_name,
    x: l.median_income_aud,
    y: l.energy_poverty_rate_pct,
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Heart className="text-red-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Energy Poverty &amp; Affordability Analytics</h1>
          <p className="text-sm text-gray-400">
            Tracking energy burden, disconnections, and hardship programs across Australia
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Households in Energy Poverty"
          value={`${avgPovertyRate.toFixed(1)}%`}
          sub="National average"
          icon={Heart}
          color="bg-red-600"
        />
        <KpiCard
          title="Avg Electricity Bill"
          value={`$${avgBill.toFixed(0)} AUD/yr`}
          sub="Across all states"
          icon={Zap}
          color="bg-amber-600"
        />
        <KpiCard
          title="Disconnections per 10k"
          value={avgDisconnections.toFixed(1)}
          sub="Latest year average"
          icon={AlertTriangle}
          color="bg-orange-600"
        />
        <KpiCard
          title="Hardship Program Participants"
          value={`${totalHardship.toFixed(1)}k`}
          sub="Total across states"
          icon={Users}
          color="bg-blue-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Energy Burden by Income Quintile (% of Income)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={burdenByQuintile}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="quintile" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="energy_burden_pct" name="Energy Burden %" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="energy_poverty_rate_pct" name="Poverty Rate %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Annual Disconnection Rates by State">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={discByYear}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              {discStates.map((st) => (
                <Line
                  key={st}
                  type="monotone"
                  dataKey={st}
                  stroke={STATE_COLOURS[st] ?? '#6b7280'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Hardship Program Outcomes by Retailer">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={hardshipByRetailer}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="retailer" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="payment_plan" name="Payment Plan (k)" stackId="a" fill={HARDSHIP_COLOURS.payment_plan} />
              <Bar dataKey="debt_waiver" name="Debt Waiver (k)" stackId="a" fill={HARDSHIP_COLOURS.debt_waiver} />
              <Bar dataKey="appliance_replacement" name="Appliance Replacement" stackId="a" fill={HARDSHIP_COLOURS.appliance_replacement} />
              <Bar dataKey="energy_audit" name="Energy Audit" stackId="a" fill={HARDSHIP_COLOURS.energy_audit} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Energy Poverty Rate vs Median Income by LGA">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="x" name="Median Income (AUD)" tick={{ fill: '#9ca3af', fontSize: 11 }} type="number" />
              <YAxis dataKey="y" name="Energy Poverty Rate (%)" tick={{ fill: '#9ca3af', fontSize: 11 }} type="number" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }}
                formatter={(val: number, name: string) => [val, name === 'x' ? 'Income AUD' : 'Poverty %']}
                labelFormatter={() => ''}
              />
              <Scatter data={lgaScatter} fill="#8b5cf6" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table: State Energy Affordability Summary */}
      <div className="bg-gray-800 rounded-2xl p-6 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">State Energy Affordability Summary</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 px-3">State</th>
              <th className="py-2 px-3">Avg Bill (AUD)</th>
              <th className="py-2 px-3">Median Income (AUD)</th>
              <th className="py-2 px-3">Energy Burden %</th>
              <th className="py-2 px-3">Disconnection Rate</th>
              <th className="py-2 px-3">Hardship Participants (k)</th>
            </tr>
          </thead>
          <tbody>
            {data.states.map((s) => (
              <tr key={s.state} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 font-medium text-white">{s.state}</td>
                <td className="py-2 px-3">${s.avg_annual_bill_aud.toLocaleString()}</td>
                <td className="py-2 px-3">${s.median_household_income_aud.toLocaleString()}</td>
                <td className="py-2 px-3">{s.energy_burden_pct.toFixed(1)}%</td>
                <td className="py-2 px-3">{s.disconnection_rate_per_10k.toFixed(1)}</td>
                <td className="py-2 px-3">{s.hardship_participants_k.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table: Retailer Hardship Performance */}
      <div className="bg-gray-800 rounded-2xl p-6 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Retailer Hardship Performance</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="py-2 px-3">Retailer</th>
              <th className="py-2 px-3">Hardship Customers (k)</th>
              <th className="py-2 px-3">Avg Debt (AUD)</th>
              <th className="py-2 px-3">Payment Plan Success %</th>
              <th className="py-2 px-3">Disconnections /10k</th>
              <th className="py-2 px-3">AER Compliant</th>
            </tr>
          </thead>
          <tbody>
            {data.retailer_hardship.map((r) => (
              <tr key={r.retailer_name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2 px-3 font-medium text-white">{r.retailer_name}</td>
                <td className="py-2 px-3">{r.hardship_customers_k.toFixed(1)}</td>
                <td className="py-2 px-3">${r.avg_debt_aud.toLocaleString()}</td>
                <td className="py-2 px-3">{r.payment_plan_success_pct.toFixed(1)}%</td>
                <td className="py-2 px-3">{r.disconnections_per_10k.toFixed(1)}</td>
                <td className="py-2 px-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.aer_compliant ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                    }`}
                  >
                    {r.aer_compliant ? 'Yes' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600 text-right">
        Data as of {new Date(data.timestamp).toLocaleString()}
      </p>
    </div>
  )
}
