import { useEffect, useState } from 'react'
import { Users, Battery, Home, TrendingUp, Loader2, AlertCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer,
} from 'recharts'
import {
  getCommunityEnergyStorageDashboard,
  CESTDashboard,
  CESTBatteryRecord,
  CESTExpansionRecord,
} from '../api/client'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

const KPICard = ({
  title, value, sub, icon: Icon, color,
}: {
  title: string; value: string; sub: string; icon: React.ElementType; color: string
}) => (
  <div className="bg-gray-800 rounded-xl p-5 flex items-start gap-4 border border-gray-700">
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-white text-2xl font-bold mt-0.5">{value}</p>
      <p className="text-gray-500 text-xs mt-1">{sub}</p>
    </div>
  </div>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-gray-100 text-lg font-semibold mb-4">{children}</h2>
)

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Active: 'bg-green-900 text-green-300',
    Pilot: 'bg-blue-900 text-blue-300',
    Planned: 'bg-yellow-900 text-yellow-300',
    Approved: 'bg-purple-900 text-purple-300',
    Proposed: 'bg-gray-700 text-gray-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {status}
    </span>
  )
}

export default function CommunityEnergyStorageAnalytics() {
  const [data, setData] = useState<CESTDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCommunityEnergyStorageDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
        <span className="ml-3 text-gray-300 text-lg">Loading community storage data...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <span className="ml-3 text-red-300 text-lg">{error ?? 'No data available'}</span>
      </div>
    )
  }

  const { batteries, households, dispatch_records, network_benefits, revenue_stacks, expansion_programs, summary } = data

  // ---- Chart: Battery capacity by DNSP ----
  const dnspCapacity: Record<string, number> = {}
  batteries.forEach(b => {
    dnspCapacity[b.dnsp] = (dnspCapacity[b.dnsp] ?? 0) + b.capacity_kwh / 1000
  })
  const dnspCapacityData = Object.entries(dnspCapacity).map(([dnsp, mwh]) => ({
    dnsp,
    capacity_mwh: Math.round(mwh * 100) / 100,
  })).sort((a, b) => b.capacity_mwh - a.capacity_mwh)

  // ---- Chart: Revenue stack composition (avg % across batteries) ----
  const revStreamTotals: Record<string, { sumPct: number; count: number }> = {}
  revenue_stacks.forEach(r => {
    if (!revStreamTotals[r.revenue_stream]) revStreamTotals[r.revenue_stream] = { sumPct: 0, count: 0 }
    revStreamTotals[r.revenue_stream].sumPct += r.pct_of_total
    revStreamTotals[r.revenue_stream].count += 1
  })
  const revenueData = Object.entries(revStreamTotals).map(([stream, v]) => ({
    name: stream,
    value: Math.round(v.sumPct / v.count * 10) / 10,
  }))

  // ---- Chart: Network benefits by benefit type ----
  const benefitTypeMap: Record<string, number> = {}
  network_benefits.forEach(n => {
    benefitTypeMap[n.benefit_type] = (benefitTypeMap[n.benefit_type] ?? 0) + n.annual_benefit_m
  })
  const networkBenefitData = Object.entries(benefitTypeMap).map(([type, val]) => ({
    type,
    annual_benefit_m: Math.round(val * 1000) / 1000,
  }))

  // ---- Chart: Household benefits — bill saving vs export income ----
  const householdBenefitData = households.slice(0, 30).map((h, i) => ({
    idx: i + 1,
    bill_saving: h.bill_saving_pa_dollar,
    export_income: h.export_income_pa_dollar,
    net_benefit: h.net_benefit_pa_dollar,
  }))

  // ---- Top 12 batteries ----
  const top12Batteries: CESTBatteryRecord[] = batteries.slice(0, 12)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-700 rounded-xl">
          <Users className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Community Energy Storage Analytics</h1>
          <p className="text-gray-400 text-sm mt-0.5">Community batteries, shared storage programs and household benefits</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Community Batteries"
          value={String(summary.total_community_batteries)}
          sub="Across 5 DNSPs nationally"
          icon={Battery}
          color="bg-blue-700"
        />
        <KPICard
          title="Total Capacity"
          value={`${summary.total_capacity_mwh} MWh`}
          sub="Installed storage capacity"
          icon={TrendingUp}
          color="bg-emerald-700"
        />
        <KPICard
          title="Households Served"
          value={summary.total_households_served.toLocaleString()}
          sub="Participating households"
          icon={Home}
          color="bg-violet-700"
        />
        <KPICard
          title="Avg Household Saving"
          value={`$${summary.avg_household_saving_pa.toFixed(0)} pa`}
          sub="Average annual bill saving"
          icon={Users}
          color="bg-amber-700"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Battery Capacity by DNSP */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <SectionTitle>Battery Capacity by DNSP (MWh)</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dnspCapacityData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis dataKey="dnsp" type="category" tick={{ fill: '#9ca3af', fontSize: 12 }} width={100} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number) => [`${v} MWh`, 'Capacity']}
              />
              <Bar dataKey="capacity_mwh" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Stack Composition */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <SectionTitle>Revenue Stack Composition (Avg %)</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={revenueData}
                cx="50%"
                cy="50%"
                outerRadius={95}
                dataKey="value"
                label={({ name, value }) => `${name.split(' ')[0]}: ${value}%`}
                labelLine={{ stroke: '#6b7280' }}
              >
                {revenueData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number) => [`${v}%`, 'Avg share']}
              />
              <Legend formatter={(v) => <span style={{ color: '#d1d5db', fontSize: 12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Network Benefits by Type */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <SectionTitle>Network Benefits by Type (Annual $M)</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={networkBenefitData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number) => [`$${v}M`, 'Annual Benefit']}
              />
              <Bar dataKey="annual_benefit_m" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Household Benefits — Bill Saving vs Export Income */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <SectionTitle>Household Benefits: Bill Saving vs Export Income ($)</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={householdBenefitData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="idx" tick={{ fill: '#9ca3af', fontSize: 12 }} label={{ value: 'Household', fill: '#6b7280', position: 'insideBottom', offset: -2 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }}
                formatter={(v: number, name: string) => [`$${v.toFixed(0)}`, name]}
              />
              <Legend formatter={(v) => <span style={{ color: '#d1d5db', fontSize: 12 }}>{v}</span>} />
              <Line type="monotone" dataKey="bill_saving" stroke="#3b82f6" dot={false} strokeWidth={2} name="Bill Saving" />
              <Line type="monotone" dataKey="export_income" stroke="#10b981" dot={false} strokeWidth={2} name="Export Income" />
              <Line type="monotone" dataKey="net_benefit" stroke="#f59e0b" dot={false} strokeWidth={2} strokeDasharray="5 5" name="Net Benefit" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Battery Overview Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionTitle>Battery Overview (Top 12)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Battery</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">DNSP</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">State</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">Capacity (kWh)</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">Households</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Technology</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Subscription</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Services</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {top12Batteries.map((b, i) => (
                <tr key={b.battery_id} className={i % 2 === 0 ? 'bg-gray-850' : ''}>
                  <td className="py-2 px-3 text-white font-medium">{b.battery_name}</td>
                  <td className="py-2 px-3 text-gray-300">{b.dnsp}</td>
                  <td className="py-2 px-3 text-gray-300">{b.state}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{b.capacity_kwh.toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{b.num_households_served}</td>
                  <td className="py-2 px-3 text-gray-300">{b.technology}</td>
                  <td className="py-2 px-3 text-gray-300">{b.subscription_model}</td>
                  <td className="py-2 px-3 text-gray-400 text-xs max-w-xs truncate">{b.available_services}</td>
                  <td className="py-2 px-3">{statusBadge(b.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expansion Programs Table */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionTitle>Expansion Programs</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Program</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">DNSP</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">State</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">Deployed</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">Planned</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">Capacity (MWh)</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">HH Target</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">CapEx ($M)</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Funding</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {expansion_programs.map((e: CESTExpansionRecord, i) => (
                <tr key={e.expansion_id} className={i % 2 === 0 ? 'bg-gray-850' : ''}>
                  <td className="py-2 px-3 text-white font-medium">{e.program_name}</td>
                  <td className="py-2 px-3 text-gray-300">{e.dnsp}</td>
                  <td className="py-2 px-3 text-gray-300">{e.state}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{e.batteries_deployed}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{e.batteries_planned}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{e.total_capacity_mwh}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{e.total_households_target.toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">${e.capex_m.toFixed(1)}</td>
                  <td className="py-2 px-3 text-gray-300">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-900 text-indigo-300">{e.funding_source}</span>
                  </td>
                  <td className="py-2 px-3">{statusBadge(e.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Summary */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <SectionTitle>Recent Dispatch Activity ({dispatch_records.length} events)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Dispatch ID</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Battery</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Date</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">Hour</th>
                <th className="text-left text-gray-400 py-2 px-3 font-medium">Service Type</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">Energy (kWh)</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">Revenue ($)</th>
                <th className="text-right text-gray-400 py-2 px-3 font-medium">Spot ($/MWh)</th>
              </tr>
            </thead>
            <tbody>
              {dispatch_records.slice(0, 20).map((d, i) => (
                <tr key={d.dispatch_id} className={i % 2 === 0 ? 'bg-gray-850' : ''}>
                  <td className="py-2 px-3 text-gray-400 font-mono text-xs">{d.dispatch_id}</td>
                  <td className="py-2 px-3 text-gray-300">{d.battery_id}</td>
                  <td className="py-2 px-3 text-gray-300">{d.date}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{d.hour}:00</td>
                  <td className="py-2 px-3 text-gray-300">{d.service_type}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">{d.energy_dispatched_kwh.toFixed(1)}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">${d.revenue_dollar.toFixed(2)}</td>
                  <td className="py-2 px-3 text-gray-300 text-right">${d.spot_price_dolpermwh.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dispatch_records.length > 20 && (
            <p className="text-gray-500 text-xs mt-2 px-3">Showing 20 of {dispatch_records.length} dispatch events</p>
          )}
        </div>
      </div>
    </div>
  )
}
