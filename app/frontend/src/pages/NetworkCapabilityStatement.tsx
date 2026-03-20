// Network Capability Statement (DAPR)
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { Activity, AlertTriangle, Zap, TrendingUp, type LucideIcon } from 'lucide-react'
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

const FALLBACK_BSPS = [
  { bsp_id: 'BSP-001', bsp_name: 'Blacktown Zone Substation', voltage_kv: 132, n1_compliant: true, headroom_pct: 18.4, peak_mva: 182, capacity_mva: 200, augmentation_status: 'Not Required', aug_year: null },
  { bsp_id: 'BSP-002', bsp_name: 'Penrith Zone Substation', voltage_kv: 66, n1_compliant: true, headroom_pct: 12.1, peak_mva: 88, capacity_mva: 100, augmentation_status: 'Planned', aug_year: 2028 },
  { bsp_id: 'BSP-003', bsp_name: 'Castle Hill Zone Substation', voltage_kv: 132, n1_compliant: false, headroom_pct: 3.8, peak_mva: 240, capacity_mva: 250, augmentation_status: 'In Progress', aug_year: 2027 },
  { bsp_id: 'BSP-004', bsp_name: 'Parramatta Zone Substation', voltage_kv: 132, n1_compliant: true, headroom_pct: 22.6, peak_mva: 154, capacity_mva: 200, augmentation_status: 'Not Required', aug_year: null },
  { bsp_id: 'BSP-005', bsp_name: 'Liverpool Zone Substation', voltage_kv: 66, n1_compliant: false, headroom_pct: 1.2, peak_mva: 99, capacity_mva: 100, augmentation_status: 'Urgent', aug_year: 2026 },
  { bsp_id: 'BSP-006', bsp_name: 'Campbelltown Zone Substation', voltage_kv: 66, n1_compliant: true, headroom_pct: 31.4, peak_mva: 68, capacity_mva: 100, augmentation_status: 'Not Required', aug_year: null },
  { bsp_id: 'BSP-007', bsp_name: 'Richmond Zone Substation', voltage_kv: 33, n1_compliant: true, headroom_pct: 15.8, peak_mva: 42, capacity_mva: 50, augmentation_status: 'Not Required', aug_year: null },
  { bsp_id: 'BSP-008', bsp_name: 'Windsor Zone Substation', voltage_kv: 66, n1_compliant: false, headroom_pct: 5.2, peak_mva: 71, capacity_mva: 75, augmentation_status: 'Planned', aug_year: 2027 },
  { bsp_id: 'BSP-009', bsp_name: 'Katoomba Zone Substation', voltage_kv: 33, n1_compliant: true, headroom_pct: 28.2, peak_mva: 22, capacity_mva: 30, augmentation_status: 'Not Required', aug_year: null },
  { bsp_id: 'BSP-010', bsp_name: 'Mulgoa Zone Substation', voltage_kv: 132, n1_compliant: true, headroom_pct: 9.4, peak_mva: 182, capacity_mva: 200, augmentation_status: 'Planned', aug_year: 2029 },
  { bsp_id: 'BSP-011', bsp_name: 'Rouse Hill Zone Substation', voltage_kv: 132, n1_compliant: false, headroom_pct: 0.4, peak_mva: 199, capacity_mva: 200, augmentation_status: 'Urgent', aug_year: 2026 },
  { bsp_id: 'BSP-012', bsp_name: 'Norwest Zone Substation', voltage_kv: 66, n1_compliant: true, headroom_pct: 14.2, peak_mva: 86, capacity_mva: 100, augmentation_status: 'Not Required', aug_year: null },
]

const augStatusBadge = (status: string) => {
  if (status === 'Urgent') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  if (status === 'In Progress') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
  if (status === 'Planned') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
}

export default function NetworkCapabilityStatement() {
  const [bsps, setBsps] = useState<any[]>([])
  const [augPipeline, setAugPipeline] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getDaprNetworkCapability(),
      api.getDaprAugmentationPipeline(),
    ]).then(([nc, aug]) => {
      setBsps(Array.isArray(nc?.items) ? nc.items : Array.isArray(nc) ? nc : FALLBACK_BSPS)
      setAugPipeline(Array.isArray(aug?.items) ? aug.items : Array.isArray(aug) ? aug : [])
      setLoading(false)
    }).catch(() => {
      setBsps(FALLBACK_BSPS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const totalBsps = bsps.length
  const n1NonCompliant = bsps.filter(b => !b.n1_compliant).length
  const augRequired = bsps.filter(b => b.augmentation_status !== 'Not Required').length
  const avgHeadroom = bsps.length ? bsps.reduce((a, b) => a + (b.headroom_pct ?? 0), 0) / bsps.length : 0

  // Sort by headroom for chart — top 20
  const chartData = [...bsps].sort((a, b) => (a.headroom_pct ?? 0) - (b.headroom_pct ?? 0)).slice(0, 20)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Network Capability Statement (DAPR)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Bulk supply point headroom, N-1 contingency compliance and augmentation pipeline — DAPR Section D3</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total BSPs" value={String(totalBsps)} sub="Bulk supply points in scope" Icon={Activity} color="bg-blue-500" />
        <KpiCard label="N-1 Non-Compliant" value={String(n1NonCompliant)} sub="Require contingency remediation" Icon={AlertTriangle} color={n1NonCompliant === 0 ? 'bg-green-500' : 'bg-red-500'} />
        <KpiCard label="Augmentations Required" value={String(augRequired)} sub="Projects in pipeline" Icon={Zap} color={augRequired > 5 ? 'bg-orange-500' : 'bg-amber-500'} />
        <KpiCard label="Avg Headroom" value={`${avgHeadroom.toFixed(1)}%`} sub="Average thermal headroom" Icon={TrendingUp} color={avgHeadroom >= 15 ? 'bg-green-500' : avgHeadroom >= 8 ? 'bg-amber-500' : 'bg-red-500'} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Headroom by Bulk Supply Point (% of thermal rating)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ bottom: 60, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="bsp_name" tick={{ fontSize: 9, fill: '#9CA3AF' }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} unit="%" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <ReferenceLine y={10} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Min 10%', position: 'insideTopRight', fill: '#EF4444', fontSize: 10 }} />
            <Bar dataKey="headroom_pct" name="Headroom %" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={
                  (entry.headroom_pct ?? 0) < 5 ? '#EF4444'
                  : (entry.headroom_pct ?? 0) < 10 ? '#F59E0B'
                  : '#10B981'
                } />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Red = &lt;5% headroom (urgent), Amber = 5–10% (planned augmentation), Green = &gt;10% (compliant)</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">BSP Network Capability Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">BSP ID</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Voltage</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">N-1</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Peak MVA</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Capacity MVA</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Headroom %</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Augmentation</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Aug. Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {bsps.map((row, i) => (
                <tr
                  key={i}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${!row.n1_compliant ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
                >
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-mono text-xs">{row.bsp_id}</td>
                  <td className="py-2.5 pr-4 text-gray-800 dark:text-gray-200 text-xs font-medium">{row.bsp_name}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 text-xs">{row.voltage_kv} kV</td>
                  <td className="py-2.5 pr-4">
                    {row.n1_compliant
                      ? <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Pass</span>
                      : <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Fail</span>
                    }
                  </td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{row.peak_mva}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{row.capacity_mva}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-bold ${(row.headroom_pct ?? 0) < 5 ? 'text-red-600 dark:text-red-400' : (row.headroom_pct ?? 0) < 10 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {(row.headroom_pct ?? 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${augStatusBadge(row.augmentation_status)}`}>
                      {row.augmentation_status}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs font-mono">{row.aug_year ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          N-1 contingency requirement per NER clause 5.20.1 — all BSPs must maintain supply following loss of single largest contingency element.
          Red rows indicate N-1 non-compliance requiring priority remediation.
        </p>
      </div>
    </div>
  )
}
