import { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, Send, Loader2, Database, ChevronRight, ArrowLeft, Table2, Code, AlertCircle, Zap, Sun, Network, CloudSun } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenieSpace {
  space_id: string
  title: string
  description: string
  icon: string
  tables: string[]
  sample_questions: string[]
}

interface ChatMessage {
  role: 'user' | 'genie'
  content: string
  sql?: string
  columns?: string[]
  rows?: unknown[][]
  status?: 'pending' | 'running' | 'done' | 'error'
  error?: string
}

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  zap: Zap,
  sun: Sun,
  network: Network,
  'cloud-sun': CloudSun,
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const BASE = ''

async function fetchSpaces(): Promise<GenieSpace[]> {
  const r = await fetch(`${BASE}/api/genie/spaces`)
  if (!r.ok) throw new Error('Failed to fetch spaces')
  const data = await r.json()
  return data.spaces
}

async function startConversation(
  spaceId: string,
  content: string
): Promise<{ conversation_id: string; message_id: string }> {
  const r = await fetch(`${BASE}/api/genie/spaces/${spaceId}/start-conversation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!r.ok) {
    const errBody = await r.text()
    throw new Error(`Failed to start conversation: ${errBody}`)
  }
  const data = await r.json()
  return {
    conversation_id: data.conversation_id,
    message_id: data.message_id,
  }
}

async function sendMessage(
  spaceId: string,
  conversationId: string,
  content: string
): Promise<{ message_id: string }> {
  const r = await fetch(
    `${BASE}/api/genie/spaces/${spaceId}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }
  )
  if (!r.ok) {
    const errBody = await r.text()
    throw new Error(`Failed to send message: ${errBody}`)
  }
  return r.json()
}

async function pollMessage(
  spaceId: string,
  conversationId: string,
  messageId: string
): Promise<Record<string, unknown>> {
  const r = await fetch(
    `${BASE}/api/genie/spaces/${spaceId}/conversations/${conversationId}/messages/${messageId}`
  )
  if (!r.ok) throw new Error('Failed to poll message')
  return r.json()
}

async function getQueryResult(
  spaceId: string,
  conversationId: string,
  messageId: string
): Promise<Record<string, unknown>> {
  const r = await fetch(
    `${BASE}/api/genie/spaces/${spaceId}/conversations/${conversationId}/messages/${messageId}/query-result`
  )
  if (!r.ok) throw new Error('Failed to fetch query result')
  return r.json()
}

// ---------------------------------------------------------------------------
// Space selector card
// ---------------------------------------------------------------------------

function SpaceCard({
  space,
  onSelect,
}: {
  space: GenieSpace
  onSelect: () => void
}) {
  const Icon = ICON_MAP[space.icon] || Sparkles
  return (
    <button
      onClick={onSelect}
      className="group text-left bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all p-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
          <Icon size={20} className="text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
            {space.title}
          </h3>
        </div>
        <ChevronRight
          size={16}
          className="text-gray-300 group-hover:text-purple-400 transition-colors shrink-0"
        />
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{space.description}</p>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {space.tables.slice(0, 4).map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
          >
            <Database size={9} />
            {t}
          </span>
        ))}
        {space.tables.length > 4 && (
          <span className="text-[10px] text-gray-400 px-1">
            +{space.tables.length - 4} more
          </span>
        )}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Results table
// ---------------------------------------------------------------------------

function ResultsTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  if (!columns.length || !rows.length) return null
  const displayRows = rows.slice(0, 100)
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                  {cell === null ? (
                    <span className="text-gray-300 italic">null</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && (
        <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-200">
          Showing 100 of {rows.length} rows
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chat message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-purple-600 text-white rounded-br-md'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
        }`}
      >
        {/* Status indicator */}
        {msg.status === 'pending' && (
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Loader2 size={12} className="animate-spin" />
            Starting conversation...
          </div>
        )}
        {msg.status === 'running' && (
          <div className="flex items-center gap-2 text-xs text-purple-500 mb-1">
            <Loader2 size={12} className="animate-spin" />
            Genie is thinking...
          </div>
        )}

        {/* Text content */}
        {msg.content && (
          <p className={`text-sm leading-relaxed ${isUser ? '' : 'text-gray-700'}`}>
            {msg.content}
          </p>
        )}

        {/* Error */}
        {msg.error && (
          <div className="flex items-center gap-2 mt-2 text-xs text-red-500">
            <AlertCircle size={12} />
            {msg.error}
          </div>
        )}

        {/* SQL query */}
        {msg.sql && (
          <details className="mt-3">
            <summary className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer hover:text-gray-600">
              <Code size={12} />
              View SQL query
            </summary>
            <pre className="mt-2 text-[11px] bg-gray-900 text-green-400 rounded-lg px-3 py-2 overflow-x-auto font-mono leading-relaxed">
              {msg.sql}
            </pre>
          </details>
        )}

        {/* Results table */}
        {msg.columns && msg.rows && (
          <div className="mt-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
              <Table2 size={12} />
              {msg.rows.length} row{msg.rows.length !== 1 ? 's' : ''} returned
            </div>
            <ResultsTable columns={msg.columns} rows={msg.rows} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chat view for a single space
// ---------------------------------------------------------------------------

function ChatView({
  space,
  onBack,
}: {
  space: GenieSpace
  onBack: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const Icon = ICON_MAP[space.icon] || Sparkles

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const updateGenieMsg = useCallback(
    (idx: number, update: Partial<ChatMessage>) => {
      setMessages((prev) => {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], ...update }
        return copy
      })
    },
    []
  )

  const extractAttachments = useCallback(
    async (
      result: Record<string, unknown>,
      convId: string,
      messageId: string
    ): Promise<Partial<ChatMessage>> => {
      const attachments = result.attachments as Record<string, unknown>[] | undefined
      let textContent = ''
      let sql = ''
      let columns: string[] = []
      let rows: unknown[][] = []

      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          if (att.text) {
            const t = att.text as Record<string, unknown>
            textContent += (t.content as string) || ''
          }
          if (att.query) {
            const q2 = att.query as Record<string, unknown>
            sql = (q2.query as string) || ''
            try {
              const qr = await getQueryResult(space.space_id, convId, messageId)
              const statement = qr.statement_response as Record<string, unknown> | undefined
              if (statement) {
                const manifest = statement.manifest as Record<string, unknown> | undefined
                const resultData = statement.result as Record<string, unknown> | undefined
                if (manifest?.schema) {
                  const schema = manifest.schema as Record<string, unknown>
                  const cols = schema.columns as { name: string }[] | undefined
                  columns = cols?.map((c) => c.name) || []
                }
                if (resultData?.data_array) {
                  rows = resultData.data_array as unknown[][]
                }
              }
            } catch {
              // Query result not available yet
            }
          }
        }
      }

      if (!textContent && !sql) {
        textContent = 'I processed your question but have no results to show.'
      }

      return {
        content: textContent,
        sql: sql || undefined,
        columns: columns.length ? columns : undefined,
        rows: rows.length ? rows : undefined,
        status: 'done' as const,
      }
    },
    [space.space_id]
  )

  const handleSend = useCallback(
    async (question: string) => {
      if (!question.trim() || sending) return
      const q = question.trim()
      setInput('')
      setSending(true)

      // Add user message + pending genie message
      const genieIdx = messages.length + 1
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: q },
        { role: 'genie', content: '', status: 'pending' },
      ])

      try {
        let convId = conversationId
        let messageId: string

        if (!convId) {
          // First message — use start-conversation which sends the question too
          updateGenieMsg(genieIdx, { status: 'running' })
          const resp = await startConversation(space.space_id, q)
          convId = resp.conversation_id
          messageId = resp.message_id
          setConversationId(convId)
        } else {
          // Follow-up message
          updateGenieMsg(genieIdx, { status: 'running' })
          const resp = await sendMessage(space.space_id, convId, q)
          messageId = resp.message_id
        }

        // Poll for completion (up to 2 minutes)
        let result: Record<string, unknown> | null = null
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          result = await pollMessage(space.space_id, convId, messageId)
          const status = result.status as string | undefined
          if (status === 'COMPLETED' || status === 'FAILED') break
        }

        const status = result?.status as string | undefined

        if (status === 'FAILED') {
          updateGenieMsg(genieIdx, {
            status: 'error',
            content: 'Genie could not answer this question.',
            error: (result?.error as string) || 'Query failed',
          })
          setSending(false)
          return
        }

        // Extract text, SQL, and results from attachments
        const genieResult = await extractAttachments(result!, convId, messageId)
        updateGenieMsg(genieIdx, genieResult)
      } catch (err) {
        updateGenieMsg(genieIdx, {
          status: 'error',
          content: '',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      } finally {
        setSending(false)
      }
    },
    [conversationId, messages.length, sending, space.space_id]
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <Icon size={16} className="text-purple-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">{space.title}</h2>
          <p className="text-[11px] text-gray-400 truncate">{space.description}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
              <Sparkles size={24} className="text-purple-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              Ask anything about your data
            </h3>
            <p className="text-xs text-gray-400 mb-6 max-w-sm">
              Genie will write and execute SQL queries against your NEM tables automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {space.sample_questions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={sending}
                  className="text-left text-xs px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50 transition-all text-gray-600 hover:text-purple-700 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
      </div>

      {/* Input */}
      <div className="px-6 py-3 border-t border-gray-200 bg-white shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(input)
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your NEM data..."
            disabled={sending}
            className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        <p className="text-[10px] text-gray-300 mt-1.5 text-center">
          Powered by Databricks AI/BI Genie &middot; Queries run against Unity Catalog gold tables
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Genie page
// ---------------------------------------------------------------------------

export default function Genie() {
  const [spaces, setSpaces] = useState<GenieSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSpace, setActiveSpace] = useState<GenieSpace | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSpaces()
      .then((s) => {
        setSpaces(s)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (activeSpace) {
    return <ChatView space={activeSpace} onBack={() => setActiveSpace(null)} />
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2.5 mb-1">
          <Sparkles size={20} className="text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900">Genie Analytics</h2>
        </div>
        <p className="text-sm text-gray-500">
          Ask natural language questions against your NEM data. Genie writes and executes SQL automatically.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-purple-400" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle size={32} className="text-red-300 mb-3" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Choose a Genie Space
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
              {spaces.map((space) => (
                <SpaceCard
                  key={space.space_id}
                  space={space}
                  onSelect={() => setActiveSpace(space)}
                />
              ))}
            </div>

            {/* Info */}
            <div className="mt-8 max-w-4xl bg-purple-50/60 border border-purple-100 rounded-xl px-5 py-4">
              <div className="flex items-start gap-3">
                <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold text-purple-700">How it works: </span>
                  Select a Genie space, then ask questions in plain English. Genie uses AI to
                  generate SQL queries against your Unity Catalog gold tables, executes them on your
                  SQL warehouse, and returns the results — all within this interface.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
