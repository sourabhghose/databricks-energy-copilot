import { useState, useEffect } from 'react'

interface Props {
  apiPath: string
  errorMessage?: string
  onRetry?: () => void
}

export default function GenericDashboardFallback({ apiPath, errorMessage, onRetry }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)
    fetch(apiPath)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setFetchError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [apiPath])

  const title = apiPath.replace('/api/', '').replace('/dashboard', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
        Loading {title}...
      </div>
    )
  }

  if (fetchError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
        <p className="text-sm">Failed to load dashboard data.</p>
        {fetchError && <p className="text-xs text-gray-500">{fetchError}</p>}
        {onRetry && (
          <button onClick={onRetry} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors">
            Retry
          </button>
        )}
      </div>
    )
  }

  // Extract summary and records from the generic auto_stubs response shape
  const summary = data.summary || data
  const records: any[] = data.records || data.data || data.items || []

  // Build KPI cards from numeric fields in summary
  const kpis: { label: string; value: string }[] = []
  if (summary && typeof summary === 'object') {
    for (const [key, val] of Object.entries(summary)) {
      if (key === 'title' || key === 'description' || key === 'data_source') continue
      if (typeof val === 'number') {
        kpis.push({ label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: val.toLocaleString() })
      } else if (typeof val === 'string' && val.length < 60) {
        kpis.push({ label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: val })
      }
    }
  }

  // Detect table columns from first record
  const columns = records.length > 0 ? Object.keys(records[0]) : []
  const displayRecords = records.slice(0, 100) // cap at 100 rows

  return (
    <div className="p-6 space-y-6">
      {/* Header with simplified-view banner */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">{summary?.title || title}</h1>
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 text-xs bg-yellow-900/50 text-yellow-300 rounded">Simplified view</span>
          {onRetry && (
            <button onClick={onRetry} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors">
              Retry full view
            </button>
          )}
        </div>
      </div>
      {errorMessage && <p className="text-xs text-gray-500">{errorMessage}</p>}

      {/* KPI cards */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {kpis.slice(0, 12).map(kpi => (
            <div key={kpi.label} className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-400 truncate">{kpi.label}</div>
              <div className="text-sm font-medium text-gray-100 mt-1 truncate">{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Data table */}
      {columns.length > 0 && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-700">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-300 whitespace-nowrap">
                      {col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {displayRecords.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-750">
                    {columns.map(col => (
                      <td key={col} className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-[200px] truncate">
                        {typeof row[col] === 'number' ? row[col].toLocaleString() : String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {records.length > 100 && (
            <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-700">
              Showing 100 of {records.length} records
            </div>
          )}
        </div>
      )}

      {kpis.length === 0 && columns.length === 0 && (
        <div className="text-center text-gray-500 py-12">No data available for this dashboard.</div>
      )}
    </div>
  )
}
