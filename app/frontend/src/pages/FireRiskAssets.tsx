// Phase 5B — Fire Risk Assets
import { useEffect, useState } from 'react'
import { api, BmpAsset } from '../api/client'

const RISK_STYLES: Record<string, string> = {
  EXTREME: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  HIGH: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  LOW: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
}
const CLEARANCE_STYLES: Record<string, string> = {
  COMPLIANT: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  ACTION_REQUIRED: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  OVERDUE: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  UNDER_REVIEW: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
}

export default function FireRiskAssets() {
  const [assets, setAssets] = useState<BmpAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [riskFilter, setRiskFilter] = useState('')
  const [clearanceFilter, setClearanceFilter] = useState('')
  const [bmoFilter, setBmoFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    api.getBushfireAssets({
      ...(riskFilter ? { risk_rating: riskFilter } : {}),
      ...(clearanceFilter ? { clearance_status: clearanceFilter } : {}),
    }).then(r => { setAssets(r.assets); setLoading(false) })
    .catch(() => setLoading(false))
  }, [riskFilter, clearanceFilter])

  const bmoZones = [...new Set(assets.map(a => a.bmo_zone))].filter(Boolean)
  const filtered = assets.filter(a => !bmoFilter || a.bmo_zone === bmoFilter)

  const extreme = filtered.filter(a => a.fire_risk_rating === 'EXTREME').length
  const high = filtered.filter(a => a.fire_risk_rating === 'HIGH').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Fire Risk Asset Register</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">BMP asset register with fire risk ratings, inspection dates and clearance status</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">AusNet Services — Synthetic</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-xs text-red-600 dark:text-red-400 mb-1">EXTREME Risk</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{extreme}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">HIGH Risk</p>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{high}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{filtered.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Action Required</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{filtered.filter(a => a.clearance_status !== 'COMPLIANT').length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Risk Ratings</option>
          <option value="EXTREME">EXTREME</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
        <select value={clearanceFilter} onChange={e => setClearanceFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All Clearance Status</option>
          <option value="COMPLIANT">Compliant</option>
          <option value="ACTION_REQUIRED">Action Required</option>
          <option value="OVERDUE">Overdue</option>
          <option value="UNDER_REVIEW">Under Review</option>
        </select>
        <select value={bmoFilter} onChange={e => setBmoFilter(e.target.value)} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">All BMO Zones</option>
          {bmoZones.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Asset Register ({filtered.length})</h2>
        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-3">Asset ID</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">BMO Zone</th>
                  <th className="pb-2 pr-3">Risk Rating</th>
                  <th className="pb-2 pr-3">Last Inspection</th>
                  <th className="pb-2 pr-3">Next Inspection</th>
                  <th className="pb-2 pr-3">Clearance Status</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.slice(0, 50).map((a, i) => (
                  <tr key={i} className={`text-gray-700 dark:text-gray-300 ${a.fire_risk_rating === 'EXTREME' ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                    <td className="py-1.5 pr-3 font-mono">{a.asset_id}</td>
                    <td className="py-1.5 pr-3">{a.asset_type}</td>
                    <td className="py-1.5 pr-3">{a.bmo_zone}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${RISK_STYLES[a.fire_risk_rating] ?? ''}`}>{a.fire_risk_rating}</span>
                    </td>
                    <td className="py-1.5 pr-3 font-mono">{a.last_inspection_date?.slice(0, 10)}</td>
                    <td className="py-1.5 pr-3 font-mono">{a.next_inspection_date?.slice(0, 10)}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CLEARANCE_STYLES[a.clearance_status] ?? ''}`}>{a.clearance_status}</span>
                    </td>
                    <td className="py-1.5 max-w-xs truncate">{a.action_required || '—'}</td>
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
