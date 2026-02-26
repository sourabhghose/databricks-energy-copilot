import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  KeyboardEvent,
} from 'react'
import { Send, Loader2, MessageSquare } from 'lucide-react'
import Markdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ---------------------------------------------------------------------------
// Public imperative handle — consumed by Copilot.tsx via ref
// ---------------------------------------------------------------------------

export interface ChatInterfaceHandle {
  /** Clear all messages and reset streaming state */
  clearChat(): void
  /** Programmatically send a question (e.g. from example-question chips) */
  sendQuestion(q: string): void
  /** Focus the textarea input */
  focusInput(): void
}

// ---------------------------------------------------------------------------
// Props — callbacks from the parent page for telemetry/UI state
// ---------------------------------------------------------------------------

interface ChatInterfaceProps {
  onDoneEvent?: (inputTokens: number, outputTokens: number, responseMs: number) => void
  onApiError?: () => void
}

const SUGGESTED_QUESTIONS = [
  "What's the current NSW spot price?",
  'Why did SA price spike yesterday?',
  'Show me the VIC demand forecast for tonight',
]

// ---------------------------------------------------------------------------
// Markdown prose styles — applied to assistant messages
// ---------------------------------------------------------------------------

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <Markdown
        components={{
          h1: ({ children }) => <h3 className="text-sm font-bold text-gray-900 mt-3 mb-1.5">{children}</h3>,
          h2: ({ children }) => <h3 className="text-sm font-bold text-gray-900 mt-3 mb-1.5">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold text-gray-800 mt-2.5 mb-1">{children}</h4>,
          h4: ({ children }) => <h4 className="text-xs font-semibold text-gray-700 mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="text-[13px] leading-relaxed text-gray-700 mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="text-gray-600">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-[13px] leading-relaxed text-gray-700">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-')
            if (isBlock) {
              return (
                <pre className="bg-gray-800 text-gray-100 rounded-lg px-3 py-2 my-2 overflow-x-auto text-xs leading-relaxed">
                  <code>{children}</code>
                </pre>
              )
            }
            return <code className="bg-gray-200 text-gray-800 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-200">{children}</thead>,
          th: ({ children }) => <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b border-gray-300">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1 text-gray-700 border-b border-gray-100">{children}</td>,
          hr: () => <hr className="my-2 border-gray-200" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-300 pl-3 my-2 text-[13px] text-gray-600 italic">{children}</blockquote>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{children}</a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[10px] font-bold mr-2.5 mt-0.5 shrink-0 shadow-sm">
          AI
        </div>
      )}
      <div
        className={[
          'max-w-[85%] rounded-2xl',
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm px-4 py-2.5 text-[13px] leading-relaxed'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm px-4 py-3 shadow-sm',
        ].join(' ')}
      >
        {isUser ? (
          message.content
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-[10px] font-bold ml-2.5 mt-0.5 shrink-0">
          You
        </div>
      )}
    </div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start mb-4">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[10px] font-bold mr-2.5 mt-0.5 shrink-0 shadow-sm">
        AI
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 bg-white border border-gray-200 text-gray-800 shadow-sm">
        {content ? (
          <MarkdownContent content={content} />
        ) : (
          <span className="flex items-center gap-1.5 text-gray-400 text-sm">
            <Loader2 size={13} className="animate-spin" />
            Thinking…
          </span>
        )}
        <span className="inline-block w-0.5 h-3.5 bg-blue-500 ml-0.5 animate-pulse align-text-bottom" />
      </div>
    </div>
  )
}

function EmptyState({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mb-4">
        <MessageSquare size={22} className="text-blue-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">AUS Energy Copilot</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-6">
        Ask anything about the National Electricity Market — prices, forecasts, outages, and more.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {SUGGESTED_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="text-left text-sm px-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/60 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

let msgIdCounter = 0
function nextId() {
  return String(++msgIdCounter)
}

// ---------------------------------------------------------------------------
// SSE done-event payload shape
// ---------------------------------------------------------------------------

interface DoneEventData {
  input_tokens?: number
  output_tokens?: number
}

// ---------------------------------------------------------------------------
// ChatInterface — exported as a forwardRef component
// ---------------------------------------------------------------------------

const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(
  function ChatInterface({ onDoneEvent, onApiError }, ref) {
    const [messages, setMessages]         = useState<Message[]>([])
    const [input, setInput]               = useState('')
    const [streaming, setStreaming]       = useState(false)
    const [streamContent, setStreamContent] = useState('')

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const abortRef    = useRef<AbortController | null>(null)

    // Auto-scroll to bottom whenever messages or stream content changes.
    useEffect(() => {
      const el = scrollContainerRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    }, [messages, streamContent])

    // -----------------------------------------------------------------------
    // Imperative handle — exposes clearChat / sendQuestion / focusInput
    // -----------------------------------------------------------------------
    useImperativeHandle(ref, () => ({
      clearChat() {
        abortRef.current?.abort()
        setMessages([])
        setInput('')
        setStreaming(false)
        setStreamContent('')
      },
      sendQuestion(q: string) {
        void sendMessage(q)
      },
      focusInput() {
        textareaRef.current?.focus()
      },
    }))

    const sendMessage = useCallback(async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || streaming) return

      const userMsg: Message = {
        id: nextId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, userMsg])
      setInput('')
      setStreaming(true)
      setStreamContent('')

      const history = messages.map(m => ({ role: m.role, content: m.content }))

      abortRef.current = new AbortController()
      const startMs = performance.now()

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const contentType = response.headers.get('content-type') ?? ''

        if (contentType.includes('text/event-stream')) {
          const reader = response.body?.getReader()
          if (!reader) throw new Error('No response body')

          const decoder = new TextDecoder()
          let accumulated = ''
          let buffer = ''
          let pendingEventName = ''
          let inputTokens = 0
          let outputTokens = 0

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                pendingEventName = line.slice(7).trim()
              } else if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') break

                if (pendingEventName === 'done') {
                  try {
                    const parsed = JSON.parse(data) as DoneEventData
                    inputTokens  = parsed.input_tokens  ?? 0
                    outputTokens = parsed.output_tokens ?? 0
                  } catch {
                    // ignore
                  }
                  pendingEventName = ''
                } else {
                  try {
                    const parsed = JSON.parse(data) as { content?: string; delta?: string }
                    const chunk = parsed.content ?? parsed.delta ?? ''
                    accumulated += chunk
                    setStreamContent(accumulated)
                  } catch {
                    accumulated += data
                    setStreamContent(accumulated)
                  }
                  pendingEventName = ''
                }
              }
            }
          }

          const assistantMsg: Message = {
            id: nextId(),
            role: 'assistant',
            content: accumulated || '(no response)',
            timestamp: new Date(),
          }
          setMessages(prev => [...prev, assistantMsg])

          const elapsedMs = Math.round(performance.now() - startMs)
          onDoneEvent?.(inputTokens, outputTokens, elapsedMs)
        } else {
          const json = await response.json() as { response?: string; message?: string; content?: string }
          const content = json.response ?? json.message ?? json.content ?? JSON.stringify(json)
          setMessages(prev => [
            ...prev,
            { id: nextId(), role: 'assistant', content, timestamp: new Date() },
          ])
          const elapsedMs = Math.round(performance.now() - startMs)
          onDoneEvent?.(0, 0, elapsedMs)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        onApiError?.()
        const errorMsg: Message = {
          id: nextId(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${(err as Error).message}. Please try again.`,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMsg])
      } finally {
        setStreaming(false)
        setStreamContent('')
        abortRef.current = null
        textareaRef.current?.focus()
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, streaming, onDoneEvent, onApiError])

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void sendMessage(input)
      }
    }

    const handleSuggestedQuestion = (q: string) => {
      void sendMessage(q)
    }

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value)
      const el = e.target
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    }

    const isEmpty = messages.length === 0 && !streaming

    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* Message list */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-5">
          {isEmpty ? (
            <EmptyState onSelect={handleSuggestedQuestion} />
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {streaming && <StreamingBubble content={streamContent} />}
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 px-5 py-3 bg-white shrink-0">
          <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask about NEM prices, forecasts, or market events… (Cmd+Enter to send)"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none max-h-40 leading-relaxed disabled:opacity-50"
            />
            <button
              onClick={() => void sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="shrink-0 p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              {streaming
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={16} />
              }
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 text-center">
            Cmd+Enter to send · AI may make errors · not financial advice
          </p>
        </div>
      </div>
    )
  }
)

export default ChatInterface
