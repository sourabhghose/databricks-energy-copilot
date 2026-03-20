// Contractor Performance Scorecard
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Users, DollarSign, CheckCircle, AlertTriangle, type LucideIcon } from 'lucide-react'
import { api } from '../api/client'

interface KpiCardProps {
  label: string; value: string; sub?: string
  Icon: LucideIcon; color: string
}
function KpiCard({ label, value, sub, Icon, color }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}><Icon size={20} className="text-white" /></div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const FALLBACK_CONTRACTORS = [
  { contractor_id: 'CTR-001', contractor_name: 'PowerGrid Services Pty Ltd', specialty: 'HV Line Maintenance', spend_ytd_m: 18.4, sla_compliance_pct: 96.2, defect_rate_pct: 0.8, safety_incidents: 0, rating: 'A' },
  { contractor_id: 'CTR-002', contractor_name: 'Network Solutions Australia', specialty: 'Substation Works', spend_ytd_m: 24.1, sla_compliance_pct: 92.8, defect_rate_pct: 1.4, safety_incidents: 1, rating: 'A' },
  { contractor_id: 'CTR-003', contractor_name: 'GreenCut Vegetation Mgmt', specialty: 'Vegetation Management', spend_ytd_m: 12.6, sla_compliance_pct: 88.4, defect_rate_pct: 2.1, safety_incidents: 0, rating: 'B' },
  { contractor_id: 'CTR-004', contractor_name: 'Inland Civil Works', specialty: 'Civil & Earthworks', spend_ytd_m: 8.8, sla_compliance_pct: 84.2, defect_rate_pct: 3.4, safety_incidents: 2, rating: 'B' },
  { contractor_id: 'CTR-005', contractor_name: 'Alpha Electrical Contractors', specialty: 'LV Network', spend_ytd_m: 15.2, sla_compliance_pct: 91.6, defect_rate_pct: 1.8, safety_incidents: 0, rating: 'A' },
  { contractor_id: 'CTR-006', contractor_name: 'Regional Crane Hire', specialty: 'Lifting & Transport', spend_ytd_m: 4.2, sla_compliance_pct: 78.3, defect_rate_pct: 4.8, safety_incidents: 3, rating: 'C' },
  { contractor_id: 'CTR-007', contractor_name: 'Digital Grid Solutions', specialty: 'SCADA/Comms', spend_ytd_m: 9.6, sla_compliance_pct: 94.1, defect_rate_pct: 1.2, safety_incidents: 0, rating: 'A' },
  { contractor_id: 'CTR-008', contractor_name: 'Coastal Line Services', specialty: 'HV Line Maintenance', spend_ytd_m: 11.4, sla_compliance_pct: 82.8, defect_rate_pct: 3.1, safety_incidents: 1, rating: 'B' },
  { contractor_id: 'CTR-009', contractor_name: 'Western Electrical Group', specialty: 'Substation Works', spend_ytd_m: 7.8, sla_compliance_pct: 71.4, defect_rate_pct: 5.6, safety_incidents: 4, rating: 'D' },
  { contractor_id: 'CTR-010', contractor_name: 'Precision Metering Co', specialty: 'Metering & AMI', spend_ytd_m: 6.2, sla_compliance_pct: 89.7, defect_rate_pct: 2.4, safety_incidents: 0, rating: 'B' },
]

const ratingBadge = (rating: string) => {
  if (rating === 'A') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (rating === 'B') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

export default function ContractorScorecard() {
  const [contractors, setContractors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getWorkforceContractors().then((d) => {
      setContractors(Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : FALLBACK_CONTRACTORS)
      setLoading(false)
    }).catch(() => {
      setContractors(FALLBACK_CONTRACTORS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const activeCount = contractors.length
  const totalSpend = contractors.reduce((a, c) => a + (c.spend_ytd_m ?? 0), 0)
  const avgSla = contractors.length ? contractors.reduce((a, c) => a + (c.sla_compliance_pct ?? 0), 0) / contractors.length : 0
  const avgDefect = contractors.length ? contractors.reduce((a, c) => a + (c.defect_rate_pct ?? 0), 0) / contractors.length : 0

  const sortedBySpend = [...contractors].sort((a, b) => (b.spend_ytd_m ?? 0) - (a.spend_ytd_m ?? 0))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Contractor Performance Scorecard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">SLA compliance, defect rates, safety incidents and spend by contractor</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Contractors" value={String(activeCount)} sub="Contracted suppliers" Icon={Users} color="bg-blue-500" />
        <KpiCard label="Total Spend YTD" value={`$${totalSpend.toFixed(1)}M`} sub="Contractor expenditure" Icon={DollarSign} color="bg-purple-500" />
        <KpiCard label="Avg SLA Compliance" value={`${avgSla.toFixed(1)}%`} sub="Across all contractors" Icon={CheckCircle} color={avgSla >= 90 ? 'bg-green-500' : avgSla >= 80 ? 'bg-amber-500' : 'bg-red-500'} />
        <KpiCard label="Avg Defect Rate" value={`${avgDefect.toFixed(1)}%`} sub="Work defects requiring rework" Icon={AlertTriangle} color={avgDefect <= 2 ? 'bg-green-500' : avgDefect <= 4 ? 'bg-amber-500' : 'bg-red-500'} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Spend YTD by Contractor ($M)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={sortedBySpend} margin={{ bottom: 50, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="contractor_name" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" M" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Bar dataKey="spend_ytd_m" fill="#3B82F6" name="Spend YTD ($M)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Contractor Performance Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Contractor</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Specialty</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Rating</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Spend YTD $M</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">SLA %</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Defect %</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Safety Incidents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {contractors.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-medium text-xs">{row.contractor_name}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 text-xs">{row.specialty}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${ratingBadge(row.rating)}`}>{row.rating}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.spend_ytd_m ?? 0).toFixed(1)}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${(row.sla_compliance_pct ?? 0) >= 90 ? 'text-green-600 dark:text-green-400' : (row.sla_compliance_pct ?? 0) >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {(row.sla_compliance_pct ?? 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${(row.defect_rate_pct ?? 0) <= 2 ? 'text-green-600 dark:text-green-400' : (row.defect_rate_pct ?? 0) <= 4 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {(row.defect_rate_pct ?? 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className={`font-semibold ${(row.safety_incidents ?? 0) === 0 ? 'text-green-600 dark:text-green-400' : (row.safety_incidents ?? 0) <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {row.safety_incidents ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
