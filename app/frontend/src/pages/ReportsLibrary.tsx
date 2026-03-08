import { useState, useEffect } from 'react'
import { FileText, Plus, RefreshCw, Download, Eye, Filter } from 'lucide-react'
import { reportsApi } from '../api/client'
import type { GeneratedReport, ReportTemplate } from '../api/client'

const TYPE_COLORS: Record<string, string> = {
  DAILY_RISK: 'bg-blue-500/20 text-blue-400',
  WEEKLY_MARKET: 'bg-green-500/20 text-green-400',
  MONTHLY_COMPLIANCE: 'bg-purple-500/20 text-purple-400',
  QUARTERLY_ENVIRONMENTAL: 'bg-teal-500/20 text-teal-400',
  AD_HOC_ANALYSIS: 'bg-yellow-500/20 text-yellow-400',
}

const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : `${n}`

export default function ReportsLibrary() {
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<GeneratedReport[]>([])
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [filterType, setFilterType] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [genType, setGenType] = useState('DAILY_RISK')
  const [genRegion, setGenRegion] = useState('NSW1')
  const [showGenForm, setShowGenForm] = useState(false)
  const [viewReport, setViewReport] = useState<GeneratedReport | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const lib = await reportsApi.library(filterType || undefined)
      setReports(lib.reports || [])
    } catch (e) { console.error('Reports load error:', e) }
    try {
      const tmpl = await reportsApi.templates()
      setTemplates(tmpl.templates || [])
    } catch (e) { console.error('Templates load error:', e) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [filterType])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const result = await reportsApi.generate(genType, genRegion)
      if (result.report_id) {
        setShowGenForm(false)
        loadData()
      }
    } catch (e) { console.error('Generate error:', e) }
    setGenerating(false)
  }

  const filteredReports = reports

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Reports Library</h1>
            <p className="text-gray-400 text-sm">Generated reports, templates & scheduling</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGenForm(!showGenForm)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Generate Report
          </button>
          <button onClick={loadData} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <button onClick={() => setFilterType('')} className={`px-3 py-1.5 rounded-lg text-sm ${filterType === '' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>All</button>
        {['DAILY_RISK', 'WEEKLY_MARKET', 'MONTHLY_COMPLIANCE', 'QUARTERLY_ENVIRONMENTAL', 'AD_HOC_ANALYSIS'].map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-sm ${filterType === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Generate Form */}
      {showGenForm && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
          <h3 className="text-white font-semibold">Generate New Report</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-gray-400 text-xs">Report Type</label>
              <select value={genType} onChange={e => setGenType(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
                {templates.map(t => <option key={t.report_type} value={t.report_type}>{t.name}</option>)}
                {templates.length === 0 && ['DAILY_RISK', 'WEEKLY_MARKET', 'MONTHLY_COMPLIANCE', 'QUARTERLY_ENVIRONMENTAL', 'AD_HOC_ANALYSIS'].map(t =>
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs">Region</label>
              <select value={genRegion} onChange={e => setGenRegion(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
                {['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleGenerate} disabled={generating} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm">
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>

          {/* Template Info */}
          {templates.length > 0 && (
            <div className="mt-4">
              <h4 className="text-gray-400 text-xs mb-2">Available Templates</h4>
              <div className="grid grid-cols-5 gap-2">
                {templates.map(t => (
                  <div key={t.report_type} className="bg-gray-900 rounded-lg p-3">
                    <p className="text-white text-xs font-medium">{t.name}</p>
                    <p className="text-gray-500 text-xs mt-1">{t.frequency}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report Viewer Modal */}
      {viewReport && (
        <div className="bg-gray-800 rounded-xl p-6 border border-blue-700 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-lg">{viewReport.title}</h3>
              <p className="text-gray-400 text-sm">{viewReport.report_type?.replace(/_/g, ' ')} · {viewReport.report_date} · {viewReport.region}</p>
            </div>
            <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-white text-sm">Close</button>
          </div>
          {viewReport.summary && (
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="text-gray-400 text-xs mb-2">Summary</h4>
              <p className="text-gray-200 text-sm">{viewReport.summary}</p>
            </div>
          )}
          <div className="bg-gray-900 rounded-lg p-4 max-h-[400px] overflow-y-auto">
            <h4 className="text-gray-400 text-xs mb-2">Content</h4>
            <pre className="text-gray-200 text-sm whitespace-pre-wrap font-sans">{viewReport.content}</pre>
          </div>
        </div>
      )}

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.map((r, i) => (
          <div key={i} className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-0.5 rounded text-xs ${TYPE_COLORS[r.report_type] || 'bg-gray-500/20 text-gray-400'}`}>
                {r.report_type?.replace(/_/g, ' ')}
              </span>
              <span className="text-gray-500 text-xs">{r.report_date}</span>
            </div>
            <h3 className="text-white font-medium text-sm mb-2">{r.title}</h3>
            {r.summary && <p className="text-gray-400 text-xs line-clamp-2 mb-3">{r.summary}</p>}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{r.region}</span>
              <div className="flex gap-2">
                <button onClick={() => setViewReport(r)} className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                  <Eye className="w-3 h-3" /> View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          No reports found. Click "Generate Report" to create one.
        </div>
      )}
    </div>
  )
}
