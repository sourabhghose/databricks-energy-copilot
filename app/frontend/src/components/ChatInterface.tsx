import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { Send, Loader2, MessageSquare } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_QUESTIONS = [
  "What's the current NSW spot price?",
  'Why did SA price spike yesterday?',
  'Show me the VIC demand forecast for tonight',
]

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-0.5 shrink-0">
          AI
        </div>
      )}
      <div
        className={[
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm',
        ].join(' ')}
      >
        {/* Render newlines as line breaks */}
        {message.content.split('\n').map((line, i) => (
          <span key={i}>
            {line}
            {i < message.content.split('\n').length - 1 && <br />}
          </span>
        ))}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-bold ml-2 mt-0.5 shrink-0">
          You
        </div>
      )}
    </div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-0.5 shrink-0">
        AI
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-gray-100 text-gray-800">
        {content || (
          <span className="flex items-center gap-1 text-gray-400">
            <Loader2 size={12} className="animate-spin" />
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
      <MessageSquare size={40} className="text-blue-200 mb-3" />
      <h3 className="text-base font-semibold text-gray-700 mb-1">AUS Energy Copilot</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-6">
        Ask anything about the National Electricity Market — prices, forecasts, outages, and more.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {SUGGESTED_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="text-left text-sm px-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
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

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState('')

  const bottomRef    = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const abortRef     = useRef<AbortController | null>(null)

  // Auto-scroll to bottom whenever messages or stream content changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

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

    // Build history for API (all prior messages)
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    abortRef.current = new AbortController()

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
        // SSE streaming response
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let accumulated = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''   // keep incomplete last line

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data) as { content?: string; delta?: string }
                const chunk = parsed.content ?? parsed.delta ?? ''
                accumulated += chunk
                setStreamContent(accumulated)
              } catch {
                // Non-JSON data chunk — append raw
                accumulated += data
                setStreamContent(accumulated)
              }
            }
          }
        }

        // Commit streamed message
        const assistantMsg: Message = {
          id: nextId(),
          role: 'assistant',
          content: accumulated || '(no response)',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMsg])
      } else {
        // Plain JSON response
        const json = await response.json() as { response?: string; message?: string; content?: string }
        const content = json.response ?? json.message ?? json.content ?? JSON.stringify(json)
        setMessages(prev => [
          ...prev,
          { id: nextId(), role: 'assistant', content, timestamp: new Date() },
        ])
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
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
  }, [messages, streaming])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  const handleSuggestedQuestion = (q: string) => {
    void sendMessage(q)
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const isEmpty = messages.length === 0 && !streaming

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <EmptyState onSelect={handleSuggestedQuestion} />
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {streaming && <StreamingBubble content={streamContent} />}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-4 py-3 bg-white shrink-0">
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
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Cmd+Enter to send · AI may make errors · not financial advice
        </p>
      </div>
    </div>
  )
}
