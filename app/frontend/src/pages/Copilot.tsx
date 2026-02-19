import { useState, useRef, useCallback, useEffect } from 'react'
import {
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Zap,
  Clock,
  Activity,
} from 'lucide-react'
import ChatInterface, { type ChatInterfaceHandle } from '../components/ChatInterface'

// ---------------------------------------------------------------------------
// Sidebar: model info + example questions + session stats
// ---------------------------------------------------------------------------

const EXAMPLE_QUESTIONS = [
  'What drove SA1 prices above $500/MWh yesterday?',
  'Compare VIC1 and NSW1 generation mix this week',
  'What is the current wind forecast for QLD1?',
  'Explain the FCAS market structure',
  'What are the current interconnector flows?',
  'What NEM rules govern AEMO\'s intervention powers?',
]

interface SidebarProps {
  onSelectQuestion: (q: string) => void
  apiError: boolean
  messageCount: number
  avgResponseMs: number
}

function Sidebar({ onSelectQuestion, apiError, messageCount, avgResponseMs }: SidebarProps) {
  return (
    <aside className="w-[200px] shrink-0 flex flex-col border-l border-gray-200 bg-gray-50 overflow-y-auto">
      {/* Model info */}
      <div className="px-3 py-3 border-b border-gray-200">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Model
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-gray-800 leading-tight">
              Claude Sonnet 4.5
            </span>
          </div>
          <div className="text-xs text-gray-400 font-mono">claude-sonnet-4-5</div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span
              className={[
                'w-2 h-2 rounded-full shrink-0',
                apiError ? 'bg-red-500' : 'bg-green-500',
              ].join(' ')}
            />
            <span
              className={[
                'text-xs font-medium',
                apiError ? 'text-red-600' : 'text-green-600',
              ].join(' ')}
            >
              {apiError ? 'API Error' : 'Online'}
            </span>
          </div>
        </div>
      </div>

      {/* Example questions */}
      <div className="px-3 py-3 border-b border-gray-200 flex-1">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Example Questions
        </div>
        <div className="flex flex-col gap-1.5">
          {EXAMPLE_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => onSelectQuestion(q)}
              className="text-left text-xs px-2.5 py-2 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-200 transition-colors leading-snug"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Session stats */}
      <div className="px-3 py-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Session Stats
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MessageSquare size={11} />
              <span>Messages</span>
            </div>
            <span className="text-xs font-semibold text-gray-700">{messageCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={11} />
              <span>Avg resp.</span>
            </div>
            <span className="text-xs font-semibold text-gray-700">
              {avgResponseMs > 0 ? `${avgResponseMs.toLocaleString()} ms` : '—'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Token counter badge
// ---------------------------------------------------------------------------

function TokenBadge({ tokens }: { tokens: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs text-gray-600">
      <Activity size={12} className="text-blue-500 shrink-0" />
      <span>
        <span className="font-semibold">{tokens.toLocaleString()}</span>
        <span className="text-gray-400 ml-0.5">tokens</span>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copilot page
// ---------------------------------------------------------------------------

export default function Copilot() {
  const chatRef = useRef<ChatInterfaceHandle>(null)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [totalTokens, setTotalTokens] = useState(0)
  const [apiError, setApiError] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [avgResponseMs, setAvgResponseMs] = useState(0)
  const [responseTimes, setResponseTimes] = useState<number[]>([])

  // Callbacks passed down to ChatInterface so it can report events upward
  const handleDoneEvent = useCallback(
    (inputTokens: number, outputTokens: number, responseMs: number) => {
      setTotalTokens(prev => prev + inputTokens + outputTokens)
      setApiError(false)
      setMessageCount(prev => prev + 1)
      setResponseTimes(prev => {
        const updated = [...prev, responseMs]
        const avg = Math.round(updated.reduce((s, t) => s + t, 0) / updated.length)
        setAvgResponseMs(avg)
        return updated
      })
    },
    []
  )

  const handleApiError = useCallback(() => {
    setApiError(true)
  }, [])

  const handleClearChat = useCallback(() => {
    chatRef.current?.clearChat()
    setTotalTokens(0)
    setMessageCount(0)
    setAvgResponseMs(0)
    setResponseTimes([])
    setApiError(false)
  }, [])

  const handleSelectQuestion = useCallback((q: string) => {
    chatRef.current?.sendQuestion(q)
  }, [])

  // Cmd/Ctrl+K — focus the chat input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        chatRef.current?.focusInput()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header row */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Copilot</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            AI-powered NEM market analyst — ask anything · Cmd+K to focus
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TokenBadge tokens={totalTokens} />
          <button
            onClick={handleClearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <Trash2 size={13} />
            Clear Chat
          </button>
        </div>
      </div>

      {/* Body: chat + collapsible sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 min-w-0 flex flex-col relative">
          <ChatInterface
            ref={chatRef}
            onDoneEvent={handleDoneEvent}
            onApiError={handleApiError}
          />

          {/* Sidebar toggle button — overlays the chat area on the right edge */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="absolute top-3 right-2 z-10 p-1 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            {sidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Collapsible sidebar */}
        {sidebarOpen && (
          <Sidebar
            onSelectQuestion={handleSelectQuestion}
            apiError={apiError}
            messageCount={messageCount}
            avgResponseMs={avgResponseMs}
          />
        )}
      </div>
    </div>
  )
}
