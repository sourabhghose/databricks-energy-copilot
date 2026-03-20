// DER Hosting Capacity Hub
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Zap, AlertTriangle, ArrowUpCircle, Activity, type LucideIcon } from 'lucide-react'
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

const CONSTRAINT_COLORS: Record<string, string> = {
  'Thermal': '#EF4444',
  'Voltage': '#F59E0B',
  'Protection': '#8B5CF6',
  'Unconstrained': '#10B981',
}

const FALLBACK_FEEDERS = [
  { feeder_id: 'F-2241', feeder_name: 'Rooftop Solar Cres 11kV', utilisation_pct: 98, constraint_type: 'Thermal', hosting_mw: 0.2, region: 'Western Sydney' },
  { feeder_id: 'F-1882', feeder_name: 'New Estate Rd 11kV', utilisation_pct: 94, constraint_type: 'Voltage', hosting_mw: 0.8, region: 'Hills District' },
  { feeder_id: 'F-0991', feeder_name: 'Industrial Park 11kV', utilisation_pct: 91, constraint_type: 'Protection', hosting_mw: 1.1, region: 'Penrith' },
  { feeder_id: 'F-3340', feeder_name: 'Residential Grove 11kV', utilisation_pct: 89, constraint_type: 'Thermal', hosting_mw: 1.4, region: 'Campbelltown' },
  { feeder_id: 'F-0442', feeder_name: 'Shopping Centre 22kV', utilisation_pct: 86, constraint_type: 'Voltage', hosting_mw: 2.1, region: 'Parramatta' },
  { feeder_id: 'F-2018', feeder_name: 'Hilltop Estate 11kV', utilisation_pct: 83, constraint_type: 'Thermal', hosting_mw: 1.8, region: 'Blue Mountains' },
  { feeder_id: 'F-1122', feeder_name: 'Rural North 33kV', utilisation_pct: 79, constraint_type: 'Protection', hosting_mw: 3.2, region: 'Hunter' },
  { feeder_id: 'F-0881', feeder_name: 'Solar Farm Rd 33kV', utilisation_pct: 76, constraint_type: 'Voltage', hosting_mw: 4.5, region: 'Central West' },
  { feeder_id: 'F-3019', feeder_name: 'Valley View 11kV', utilisation_pct: 72, constraint_type: 'Thermal', hosting_mw: 2.8, region: 'Southern Highlands' },
  { feeder_id: 'F-0228', feeder_name: 'Greenfield Estate 11kV', utilisation_pct: 68, constraint_type: 'Unconstrained', hosting_mw: 6.4, region: 'Wollondilly' },
  { feeder_id: 'F-1661', feeder_name: 'Bay View 11kV', utilisation_pct: 64, constraint_type: 'Unconstrained', hosting_mw: 7.1, region: 'Illawarra' },
  { feeder_id: 'F-2882', feeder_name: 'Coastal Strip 22kV', utilisation_pct: 58, constraint_type: 'Unconstrained', hosting_mw: 9.2, region: 'Central Coast' },
  { feeder_id: 'F-0339', feeder_name: 'Highland Ridge 11kV', utilisation_pct: 52, constraint_type: 'Unconstrained', hosting_mw: 8.8, region: 'New England' },
  { feeder_id: 'F-1490', feeder_name: 'Airport West 22kV', utilisation_pct: 48, constraint_type: 'Unconstrained', hosting_mw: 12.4, region: 'Western Sydney' },
  { feeder_id: 'F-0771', feeder_name: 'Open Country 33kV', utilisation_pct: 41, constraint_type: 'Unconstrained', hosting_mw: 18.6, region: 'Riverina' },
]

export default function HostingCapacityHub() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [feeders, setFeeders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getHostingCapacitySummary(),
      api.getHostingCapacityFeeders(),
    ]).then(([s, f]) => {
      setSummary(s ?? {})
      setFeeders(Array.isArray(f?.items) ? f.items : Array.isArray(f) ? f : FALLBACK_FEEDERS)
      setLoading(false)
    }).catch(() => {
      setFeeders(FALLBACK_FEEDERS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const totalHostingMW = summary.total_hosting_mw ?? feeders.reduce((a, f) => a + (f.hosting_mw ?? 0), 0)
  const constrainedCount = summary.constrained_feeders ?? feeders.filter(f => f.utilisation_pct >= 80).length
  const derQueueMW = summary.der_queue_mw ?? 142.8
  const curtailmentEvents = summary.curtailment_events_ytd ?? 38

  const top15 = feeders.slice(0, 15)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">DER Hosting Capacity</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Feeder utilisation, DER connection queue and curtailment risk assessment</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Hosting Capacity" value={`${totalHostingMW.toFixed(0)} MW`} sub="Available across all feeders" Icon={Zap} color="bg-green-500" />
        <KpiCard label="Constrained Feeders" value={String(constrainedCount)} sub="Utilisation ≥ 80%" Icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="DER Connection Queue" value={`${derQueueMW.toFixed(0)} MW`} sub="Pending applications" Icon={ArrowUpCircle} color="bg-amber-500" />
        <KpiCard label="Curtailment Events YTD" value={String(curtailmentEvents)} sub="This calendar year" Icon={Activity} color={curtailmentEvents > 30 ? 'bg-orange-500' : 'bg-blue-500'} />
      </div>

      {/* Constraint legend */}
      <div className="flex items-center gap-6 flex-wrap">
        {Object.entries(CONSTRAINT_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{type}</span>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Feeder Utilisation — Top 15 (% of thermal rating)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={top15} margin={{ bottom: 60, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="feeder_name" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Bar dataKey="utilisation_pct" name="Utilisation %" radius={[3, 3, 0, 0]}>
              {top15.map((entry, i) => (
                <Cell key={i} fill={CONSTRAINT_COLORS[entry.constraint_type] ?? '#6B7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Feeder Hosting Capacity Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Feeder</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Region</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Utilisation %</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Constraint</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Hosting (MW)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {feeders.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-mono text-xs">{row.feeder_id}</td>
                  <td className="py-2.5 pr-4 text-gray-800 dark:text-gray-200 text-xs">{row.feeder_name}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 text-xs">{row.region}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${(row.utilisation_pct ?? 0) >= 90 ? 'text-red-600 dark:text-red-400' : (row.utilisation_pct ?? 0) >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {row.utilisation_pct}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className="px-2 py-0.5 text-xs rounded-full text-white font-medium"
                      style={{ backgroundColor: CONSTRAINT_COLORS[row.constraint_type] ?? '#6B7280' }}
                    >
                      {row.constraint_type}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-900 dark:text-gray-100 font-semibold">{(row.hosting_mw ?? 0).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
