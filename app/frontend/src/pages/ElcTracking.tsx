// Phase 5B — ELC Inspection Tracking
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api, ElcInspection } from '../api/client'

const STATUS_STYLES: Record<string, string> = {
  COMPLIANT: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  WARNING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  NON_COMPLIANT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

export default function ElcTracking() {
  const [inspections, setInspections] = useState<ElcInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    api.getElcInspections(statusFilter ? { status: statusFilter } : {})
      .then(r => { setInspections(r.inspections); setLoading(false) })
      .catch(() => setLoading(false))
  }, [statusFilter])

  const filtered = inspections.filter(i =>
    !search || i.feeder_id?.toLowerCase().includes(search.toLowerCase()) ||
    i.vegetation_species?.toLowerCase().includes(search.toLowerCase())
  )

  const nonCompliant = inspections.filter(i => i.clearance_status === 'NON_COMPLIANT').length
  const warning = inspections.filter(i => i.clearance_status === 'WARNING').length
  const compliant = inspections.filter(i => i.clearance_status === 'COMPLIANT').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ELC Inspection Tracking</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Electrical Line Clearance inspections — span-level vegetation encroachment monitoring</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">AusNet Services — Synthetic</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <p className="text-xs text-green-600 dark:text-green-400 mb-1">Compliant Spans</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{compliant}</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Warning (encroachment 1.5–3m)</p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{warning}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-xs text-red-600 dark:text-red-400 mb-1">Non-Compliant (encroachment &gt;3m)</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{nonCompliant}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            placeholder="Search feeder or species..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Status</option>
          <option value="COMPLIANT">Compliant</option>
          <option value="WARNING">Warning</option>
          <option value="NON_COMPLIANT">Non-Compliant</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">ELC Inspections ({filtered.length})</h2>
        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-3">Inspection ID</th>
                  <th className="pb-2 pr-3">Feeder</th>
                  <th className="pb-2 pr-3">Span</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Inspector</th>
                  <th className="pb-2 pr-3">Species</th>
                  <th className="pb-2 pr-3">Encroachment (m)</th>
                  <th className="pb-2 pr-3">Action</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.slice(0, 50).map((r, i) => (
                  <tr key={i} className={`text-gray-700 dark:text-gray-300 ${r.clearance_status === 'NON_COMPLIANT' ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                    <td className="py-1.5 pr-3 font-mono">{r.inspection_id}</td>
                    <td className="py-1.5 pr-3">{r.feeder_id}</td>
                    <td className="py-1.5 pr-3">{r.span_id}</td>
                    <td className="py-1.5 pr-3">{r.inspection_date?.slice(0, 10)}</td>
                    <td className="py-1.5 pr-3">{r.inspector}</td>
                    <td className="py-1.5 pr-3 italic">{r.vegetation_species}</td>
                    <td className={`py-1.5 pr-3 font-mono ${r.encroachment_m > 3 ? 'text-red-600 dark:text-red-400 font-bold' : r.encroachment_m > 1.5 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>{r.encroachment_m?.toFixed(2)}</td>
                    <td className="py-1.5 pr-3 max-w-xs truncate">{r.action_taken}</td>
                    <td className="py-1.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[r.clearance_status] ?? ''}`}>{r.clearance_status}</span>
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
