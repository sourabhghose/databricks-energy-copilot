// DER Export Management & Dynamic Operating Envelopes
import { useEffect, useState } from 'react'
import { Sun, Network, AlertTriangle, CheckCircle, type LucideIcon } from 'lucide-react'
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

export default function DerExportManagement() {
  const [summary, setSummary] = useState<Record<string, any>>({})
  const [feeders, setFeeders] = useState<any[]>([])
  const [curtailments, setCurtailments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getDerExportSummary(),
      api.getDerExportFeeders(),
      api.getDerCurtailmentEvents(),
    ]).then(([s, f, c]) => {
      setSummary(s ?? {})
      setFeeders(Array.isArray(f?.feeders) ? f.feeders : Array.isArray(f) ? f : [])
      setCurtailments(Array.isArray(c?.events) ? c.events : Array.isArray(c) ? c : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">DER Export Management &amp; Dynamic Operating Envelopes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Solar penetration, export limits, hosting capacity and curtailment events</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Feeders with DOE" value={String(summary.feeders_with_doe ?? 0)} sub="Dynamic operating envelopes" Icon={Network} color="bg-blue-500" />
        <KpiCard label="Total Solar Capacity" value={`${(summary.total_solar_mw ?? 0).toFixed(0)} MW`} sub="Connected DER capacity" Icon={Sun} color="bg-yellow-500" />
        <KpiCard label="Curtailment Events (30d)" value={String(summary.curtailment_events_30d ?? 0)} sub="Export curtailments issued" Icon={AlertTriangle} color="bg-orange-500" />
        <KpiCard label="DOE Compliance" value={`${(summary.doe_compliance_pct ?? 0).toFixed(1)}%`} sub="Customers within envelope" Icon={CheckCircle} color="bg-green-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Feeder Solar Penetration &amp; Hosting Capacity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Feeder</th>
                <th className="pb-2 pr-4">Solar Penetration %</th>
                <th className="pb-2 pr-4">Export Limit (kW)</th>
                <th className="pb-2">Hosting Capacity Remaining (kW)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {feeders.map((f, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4 font-medium">{f.feeder_id ?? f.feeder}</td>
                  <td className="py-1.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${(f.solar_penetration_pct ?? 0) >= 80 ? 'bg-red-500' : (f.solar_penetration_pct ?? 0) >= 60 ? 'bg-orange-500' : 'bg-yellow-400'}`}
                          style={{ width: `${Math.min(100, f.solar_penetration_pct ?? 0)}%` }}
                        />
                      </div>
                      <span>{(f.solar_penetration_pct ?? 0).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-1.5 pr-4">{(f.export_limit_kw ?? 0).toLocaleString()}</td>
                  <td className="py-1.5">{(f.hosting_capacity_remaining_kw ?? f.remaining_capacity_kw ?? 0).toLocaleString()}</td>
                </tr>
              ))}
              {feeders.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-400 dark:text-gray-500">No feeder data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Recent Curtailment Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Feeder</th>
                <th className="pb-2 pr-4">Duration (min)</th>
                <th className="pb-2 pr-4">Customers Affected</th>
                <th className="pb-2">Energy Curtailed (kWh)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {curtailments.map((c, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-4">{c.event_date ?? c.date}</td>
                  <td className="py-1.5 pr-4 font-medium">{c.feeder_id ?? c.feeder}</td>
                  <td className="py-1.5 pr-4">{c.duration_min ?? '—'}</td>
                  <td className="py-1.5 pr-4">{(c.customers_affected ?? 0).toLocaleString()}</td>
                  <td className="py-1.5">{(c.energy_curtailed_kwh ?? 0).toLocaleString()}</td>
                </tr>
              ))}
              {curtailments.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-400 dark:text-gray-500">No curtailment events</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
