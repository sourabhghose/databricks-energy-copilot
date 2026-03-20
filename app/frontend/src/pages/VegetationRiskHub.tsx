// Satellite Vegetation Risk Intelligence
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Leaf, AlertTriangle, CheckCircle, Zap, type LucideIcon } from 'lucide-react'
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

const FALLBACK_ZONES = [
  { zone: 'Blue Mountains', avg_risk_score: 8.7, span_count: 142, high_risk_spans: 38 },
  { zone: 'Hunter Valley', avg_risk_score: 7.9, span_count: 288, high_risk_spans: 52 },
  { zone: 'Southern Highlands', avg_risk_score: 7.4, span_count: 198, high_risk_spans: 41 },
  { zone: 'Central West', avg_risk_score: 6.8, span_count: 340, high_risk_spans: 29 },
  { zone: 'Illawarra', avg_risk_score: 5.9, span_count: 122, high_risk_spans: 14 },
  { zone: 'Mid North Coast', avg_risk_score: 5.4, span_count: 264, high_risk_spans: 18 },
  { zone: 'Western Sydney', avg_risk_score: 4.2, span_count: 94, high_risk_spans: 6 },
  { zone: 'Newcastle Metro', avg_risk_score: 3.8, span_count: 82, high_risk_spans: 4 },
]

const FALLBACK_SPANS = [
  { span_id: 'SP-8812', location: 'Woodford–Bell 33kV span 44', zone: 'Blue Mountains', risk_score: 9.4, vegetation_type: 'Native Eucalypt', clearance_m: 0.8, last_inspection: '2025-06-12', satellite_change: 'High Growth', status: 'Works Ordered' },
  { span_id: 'SP-3341', location: 'Cessnock–Kurri 11kV span 18', zone: 'Hunter Valley', risk_score: 9.2, vegetation_type: 'Wattle Regrowth', clearance_m: 0.6, last_inspection: '2025-07-01', satellite_change: 'High Growth', status: 'Overdue' },
  { span_id: 'SP-6028', location: 'Mittagong–Bowral 22kV span 7', zone: 'Southern Highlands', risk_score: 8.9, vegetation_type: 'Native Eucalypt', clearance_m: 1.1, last_inspection: '2025-08-18', satellite_change: 'Moderate Growth', status: 'Inspection Due' },
  { span_id: 'SP-2204', location: 'Lithgow–Portland 33kV span 31', zone: 'Central West', risk_score: 8.6, vegetation_type: 'Casuarina', clearance_m: 0.9, last_inspection: '2025-05-22', satellite_change: 'High Growth', status: 'Works Ordered' },
  { span_id: 'SP-7719', location: 'Katoomba–Leura 11kV span 12', zone: 'Blue Mountains', risk_score: 8.3, vegetation_type: 'Native Eucalypt', clearance_m: 1.4, last_inspection: '2025-09-30', satellite_change: 'Moderate Growth', status: 'Inspection Due' },
  { span_id: 'SP-4455', location: 'Singleton–Broke 33kV span 22', zone: 'Hunter Valley', risk_score: 8.1, vegetation_type: 'Wattle Regrowth', clearance_m: 0.7, last_inspection: '2025-04-15', satellite_change: 'High Growth', status: 'Overdue' },
  { span_id: 'SP-1183', location: 'Bundanoon–Exeter 11kV span 9', zone: 'Southern Highlands', risk_score: 7.9, vegetation_type: 'Pine Plantation', clearance_m: 1.2, last_inspection: '2025-10-08', satellite_change: 'Low Growth', status: 'Compliant' },
  { span_id: 'SP-5567', location: 'Orange–Blayney 22kV span 15', zone: 'Central West', risk_score: 7.7, vegetation_type: 'Native Eucalypt', clearance_m: 1.6, last_inspection: '2025-11-02', satellite_change: 'Moderate Growth', status: 'Compliant' },
  { span_id: 'SP-9920', location: 'Mudgee–Gulgong 33kV span 8', zone: 'Central West', risk_score: 7.5, vegetation_type: 'Casuarina', clearance_m: 0.5, last_inspection: '2025-03-14', satellite_change: 'High Growth', status: 'Overdue' },
  { span_id: 'SP-3388', location: 'Wollongong–Albion Park 22kV span 4', zone: 'Illawarra', risk_score: 7.2, vegetation_type: 'Coastal Scrub', clearance_m: 2.1, last_inspection: '2025-12-01', satellite_change: 'Low Growth', status: 'Compliant' },
]

const satelliteChangeBadge = (change: string) => {
  if (change === 'High Growth') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  if (change === 'Moderate Growth') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
}

const statusBadge = (status: string) => {
  if (status === 'Overdue') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  if (status === 'Works Ordered') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
  if (status === 'Inspection Due') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
}

const riskColor = (score: number) => {
  if (score >= 8.5) return '#EF4444'
  if (score >= 7) return '#F59E0B'
  if (score >= 5) return '#3B82F6'
  return '#10B981'
}

export default function VegetationRiskHub() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [zones, setZones] = useState<any[]>([])
  const [spans, setSpans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getVegRiskSummary(),
      api.getVegRiskSpans(),
    ]).then(([s, sp]) => {
      setSummary(s ?? {})
      setZones(Array.isArray(s?.zones) ? s.zones : FALLBACK_ZONES)
      setSpans(Array.isArray(sp?.items) ? sp.items : Array.isArray(sp) ? sp : FALLBACK_SPANS)
      setLoading(false)
    }).catch(() => {
      setZones(FALLBACK_ZONES)
      setSpans(FALLBACK_SPANS)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  const networkKm = summary.network_km ?? 18420
  const highRiskSpans = summary.high_risk_spans ?? zones.reduce((a, z) => a + (z.high_risk_spans ?? 0), 0)
  const inspectionCompliance = summary.inspection_compliance_pct ?? 82.4
  const outagesFromVeg = summary.outages_from_vegetation_ytd ?? 14

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Satellite Vegetation Risk Intelligence</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">NDVI satellite change detection, risk scoring and ELC compliance tracking</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Network (km)" value={networkKm.toLocaleString()} sub="Circuit kilometres in scope" Icon={Leaf} color="bg-green-500" />
        <KpiCard label="High Risk Spans" value={String(highRiskSpans)} sub="Risk score ≥ 7.0" Icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Inspection Compliance" value={`${inspectionCompliance.toFixed(1)}%`} sub="ELC inspection programme" Icon={CheckCircle} color={inspectionCompliance >= 90 ? 'bg-green-500' : inspectionCompliance >= 75 ? 'bg-amber-500' : 'bg-red-500'} />
        <KpiCard label="Vegetation Outages YTD" value={String(outagesFromVeg)} sub="Vegetation-attributable faults" Icon={Zap} color={outagesFromVeg <= 10 ? 'bg-green-500' : 'bg-orange-500'} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Average Risk Score by Zone</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={zones} margin={{ bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis dataKey="zone" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-20} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} domain={[0, 10]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#F9FAFB' }}
              itemStyle={{ color: '#D1D5DB' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
            <Bar dataKey="avg_risk_score" name="Avg Risk Score (0–10)" radius={[3, 3, 0, 0]}>
              {zones.map((entry, i) => (
                <Cell key={i} fill={riskColor(entry.avg_risk_score ?? 0)} />
              ))}
            </Bar>
            <Bar dataKey="high_risk_spans" fill="#6B7280" name="High-Risk Span Count" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Top-10 Highest Risk Spans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Span ID</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Location</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Zone</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Risk Score</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Vegetation</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Clearance (m)</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 pr-4">Satellite Change</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {spans.slice(0, 10).map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100 font-mono text-xs">{row.span_id}</td>
                  <td className="py-2.5 pr-4 text-gray-800 dark:text-gray-200 text-xs">{row.location}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 text-xs">{row.zone}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-bold ${(row.risk_score ?? 0) >= 8.5 ? 'text-red-600 dark:text-red-400' : (row.risk_score ?? 0) >= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {(row.risk_score ?? 0).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 text-xs">{row.vegetation_type}</td>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{(row.clearance_m ?? 0).toFixed(1)}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${satelliteChangeBadge(row.satellite_change)}`}>{row.satellite_change}</span>
                  </td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadge(row.status)}`}>{row.status}</span>
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
