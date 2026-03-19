// Phase 5B — Seasonal Readiness Checklist
import { useEffect, useState } from 'react'
import { api, SeasonalReadiness as SeasonalReadinessRecord } from '../api/client'

const STATUS_STYLES: Record<string, string> = {
  COMPLETE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  'IN PROGRESS': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'NOT STARTED': 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  OVERDUE: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

export default function SeasonalReadiness() {
  const [readiness, setReadiness] = useState<SeasonalReadinessRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState(2026)

  useEffect(() => {
    api.getSeasonalReadiness({ dnsp: 'AusNet Services' })
      .then(r => { setReadiness(r.readiness); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = readiness.filter(r => r.season_year === yearFilter)
  const categories = [...new Set(filtered.map(r => r.check_category))].filter(Boolean)

  const overallPct = filtered.length > 0
    ? filtered.reduce((s, r) => s + r.completion_pct, 0) / filtered.length
    : 0
  const complete = filtered.filter(r => r.status === 'COMPLETE').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Seasonal Readiness Checklist</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pre-summer preparation checklist for bushfire season — AusNet Services</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))} className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <option value={2026}>2026 Season</option>
            <option value={2025}>2025 Season</option>
          </select>
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Synthetic</span>
        </div>
      </div>

      {/* Overall progress */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Overall Readiness — {yearFilter} Summer Season</h2>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{overallPct.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full ${overallPct >= 90 ? 'bg-green-500' : overallPct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>✓ {complete} complete</span>
          <span>○ {filtered.length - complete} remaining</span>
          <span>Total: {filtered.length} items</span>
        </div>
      </div>

      {/* Category cards */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => {
            const catItems = filtered.filter(r => r.check_category === cat)
            const catPct = catItems.length > 0 ? catItems.reduce((s, r) => s + r.completion_pct, 0) / catItems.length : 0
            return (
              <div key={cat} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cat}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${catPct >= 90 ? 'bg-green-500' : catPct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${catPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{catPct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {catItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'COMPLETE' ? 'bg-green-500' : item.status === 'IN PROGRESS' ? 'bg-blue-500' : item.status === 'OVERDUE' ? 'bg-red-500' : 'bg-gray-400'}`} />
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{item.check_item}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                        <span className="text-xs text-gray-400 font-mono">{item.target_completion_date?.slice(0, 10)}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[item.status] ?? ''}`}>{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
