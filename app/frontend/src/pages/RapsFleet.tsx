// Phase 5B — RAPS Fleet Dashboard
import { useEffect, useState } from 'react'
import { api, RapsSite } from '../api/client'

const STATUS_STYLES: Record<string, string> = {
  OPERATIONAL: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  MAINTENANCE: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  FAULT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

export default function RapsFleet() {
  const [sites, setSites] = useState<RapsSite[]>([])
  const [loading, setLoading] = useState(true)
  const [regionFilter, setRegionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    api.getRapsFleet({ dnsp: 'Ergon Energy', ...(regionFilter ? { region: regionFilter } : {}) })
      .then(r => { setSites(r.raps); setLoading(false) })
      .catch(() => setLoading(false))
  }, [regionFilter])

  const filtered = sites.filter(s => !statusFilter || s.site_status === statusFilter)
  const regions = [...new Set(sites.map(s => s.region))].filter(Boolean).sort()

  const totalSolar = filtered.reduce((s, x) => s + x.solar_kw, 0)
  const totalBattery = filtered.reduce((s, x) => s + x.battery_kwh, 0)
  const operational = filtered.filter(s => s.site_status === 'OPERATIONAL').length
  const fault = filtered.filter(s => s.site_status === 'FAULT').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">RAPS Fleet Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Remote Area Power Supply fleet — Ergon Energy Queensland</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Ergon Energy — Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sites', value: String(filtered.length), color: 'border-blue-500' },
          { label: 'Operational', value: String(operational), color: 'border-green-500' },
          { label: 'Total Solar (kW)', value: totalSolar.toFixed(0), color: 'border-yellow-500' },
          { label: 'Total Battery (kWh)', value: totalBattery.toFixed(0), color: 'border-purple-500' },
        ].map((k, i) => (
          <div key={i} className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 border border-gray-200 dark:border-gray-700 ${k.color} p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{k.value}</p>
          </div>
        ))}
      </div>

      {fault > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">⚠ {fault} site{fault > 1 ? 's' : ''} in FAULT status — immediate attention required</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Status</option>
          <option value="OPERATIONAL">Operational</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="FAULT">Fault</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">RAPS Sites ({filtered.length})</h2>
        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-3">Site ID</th>
                  <th className="pb-2 pr-3">Region</th>
                  <th className="pb-2 pr-3">NMI</th>
                  <th className="pb-2 pr-3">Solar (kW)</th>
                  <th className="pb-2 pr-3">Battery (kWh)</th>
                  <th className="pb-2 pr-3">Diesel (kVA)</th>
                  <th className="pb-2 pr-3">Last Service</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.slice(0, 40).map((s, i) => (
                  <tr key={i} className={`text-gray-700 dark:text-gray-300 ${s.site_status === 'FAULT' ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                    <td className="py-1.5 pr-3 font-mono">{s.site_id}</td>
                    <td className="py-1.5 pr-3">{s.region}</td>
                    <td className="py-1.5 pr-3 font-mono text-[10px]">{s.customer_nmi}</td>
                    <td className="py-1.5 pr-3">{s.solar_kw}</td>
                    <td className="py-1.5 pr-3">{s.battery_kwh?.toFixed(1)}</td>
                    <td className="py-1.5 pr-3">{s.diesel_kva}</td>
                    <td className="py-1.5 pr-3 font-mono">{s.last_service_date?.slice(0, 10)}</td>
                    <td className="py-1.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[s.site_status] ?? ''}`}>{s.site_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
