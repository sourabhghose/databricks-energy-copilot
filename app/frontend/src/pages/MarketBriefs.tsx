import { useState, useEffect, useCallback } from 'react'
import { FileText, RefreshCw, ChevronDown, ChevronUp, Zap } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketBrief {
    brief_id: string
    brief_date: string
    brief_type: string
    title: string
    narrative: string
    key_metrics: Record<string, any>
    generated_at: string
    word_count: number
}

// ---------------------------------------------------------------------------
// Markdown-lite renderer (for ## headings, **bold**, - lists)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string) {
    return text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) {
            return <h3 key={i} className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-3 mb-1">{line.slice(3)}</h3>
        }
        if (line.startsWith('- ')) {
            const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            return <li key={i} className="text-sm text-gray-700 dark:text-gray-300 ml-4" dangerouslySetInnerHTML={{ __html: content }} />
        }
        if (line.startsWith('*') && line.endsWith('*')) {
            return <p key={i} className="text-sm italic text-gray-500 dark:text-gray-400">{line.replace(/\*/g, '')}</p>
        }
        if (line.trim() === '') return <div key={i} className="h-1" />
        const content = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        return <p key={i} className="text-sm text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: content }} />
    })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarketBriefs() {
    const [briefs, setBriefs] = useState<MarketBrief[]>([])
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    const fetchBriefs = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/market-briefs?brief_type=daily&limit=20')
            const data = await res.json()
            setBriefs(data.briefs || [])
        } catch {
            setBriefs([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchBriefs() }, [fetchBriefs])

    const handleGenerate = async () => {
        setGenerating(true)
        try {
            const res = await fetch('/api/market-briefs/generate?brief_type=daily', { method: 'POST' })
            const data = await res.json()
            if (data.brief_id) {
                setBriefs(prev => [data, ...prev])
                setExpanded(prev => new Set(prev).add(data.brief_id))
            }
        } catch {
            // ignore
        } finally {
            setGenerating(false)
        }
    }

    const toggle = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    return (
        <div className="p-6 space-y-5 max-w-[900px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText size={22} className="text-blue-500" /> Market Briefs
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">AI-generated market intelligence summaries</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                        {generating ? 'Generating...' : 'Generate Brief'}
                    </button>
                    <button onClick={fetchBriefs} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                        <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : 'text-gray-500'} />
                    </button>
                </div>
            </div>

            {/* Brief cards */}
            {loading && briefs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">Loading briefs...</div>
            ) : briefs.length === 0 ? (
                <div className="text-center py-12">
                    <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">No briefs generated yet. Click "Generate Brief" to create one.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {briefs.map(brief => {
                        const isExpanded = expanded.has(brief.brief_id)
                        return (
                            <div
                                key={brief.brief_id}
                                className="bg-white dark:bg-[#1C2128] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                            >
                                <button
                                    onClick={() => toggle(brief.brief_id)}
                                    className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                {brief.title}
                                            </span>
                                            <span className="shrink-0 px-2 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                                {brief.brief_type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                            <span>{new Date(brief.generated_at).toLocaleString()}</span>
                                            <span>{brief.word_count} words</span>
                                            {brief.key_metrics?.key_events !== undefined && (
                                                <span>{brief.key_metrics.key_events} events</span>
                                            )}
                                            {brief.key_metrics?.renewable_pct !== undefined && (
                                                <span>{brief.key_metrics.renewable_pct}% renewable</span>
                                            )}
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                </button>
                                {isExpanded && (
                                    <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                            {renderMarkdown(brief.narrative)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
