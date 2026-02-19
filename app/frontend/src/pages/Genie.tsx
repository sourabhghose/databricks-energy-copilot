import { useRef } from 'react'
import { Sparkles, ExternalLink, Info, Send } from 'lucide-react'

// ---------------------------------------------------------------------------
// Vite env var helpers — typed access without casting throughout the file
// ---------------------------------------------------------------------------

const env = (import.meta as Record<string, unknown> & { env: Record<string, string> }).env
const GENIE_SPACE_ID: string = env.VITE_GENIE_SPACE_ID ?? ''
const GENIE_URL: string = env.VITE_GENIE_URL ?? ''

// Derive the iframe URL: prefer explicit VITE_GENIE_URL, otherwise build from space ID
const IFRAME_URL: string =
  GENIE_URL ||
  (GENIE_SPACE_ID
    ? `https://<workspace>.azuredatabricks.net/genie/spaces/${GENIE_SPACE_ID}`
    : '')

// ---------------------------------------------------------------------------
// Preset queries posted to the Genie iframe via postMessage
// ---------------------------------------------------------------------------

const PRESET_QUERIES = [
  'Show me average daily prices by region for the last 7 days',
  'What was the maximum demand in each region this month?',
  'Show generation by fuel type for NSW1 last week',
] as const

// ---------------------------------------------------------------------------
// Setup instructions panel (shown when VITE_GENIE_SPACE_ID is not set)
// ---------------------------------------------------------------------------

function SetupPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-gray-500">
      <Sparkles size={48} className="text-purple-200 mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 mb-2">Genie AI Analytics</h3>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        Set{' '}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
          VITE_GENIE_SPACE_ID
        </code>{' '}
        in your{' '}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
          .env.local
        </code>{' '}
        file to connect to your Databricks Genie space.
      </p>

      {/* Code block */}
      <div className="w-full max-w-sm mb-6">
        <pre className="text-left bg-gray-900 text-green-400 text-xs font-mono rounded-lg px-4 py-3 leading-relaxed overflow-x-auto">
          {`VITE_GENIE_SPACE_ID=your-space-id-here`}
        </pre>
      </div>

      {/* Docs link placeholder */}
      <p className="text-xs text-gray-400 mb-8">
        <a
          href="#databricks-genie-docs"
          className="text-blue-500 hover:underline"
          onClick={e => e.preventDefault()}
        >
          View Databricks Genie documentation
        </a>
      </p>

      {/* What Genie is */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg px-5 py-4 max-w-lg text-left flex gap-3 mb-8">
        <Info size={16} className="text-purple-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 leading-relaxed">
          <span className="font-semibold text-purple-700">What is Genie?</span>{' '}
          Genie allows natural language queries directly against your NEM data in Unity Catalog
          using AI-powered SQL generation. Ask questions like "average price last week" and Genie
          writes and runs the SQL automatically.
        </p>
      </div>

      {/* Placeholder feature list */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl text-left">
        {[
          {
            title: 'NEM Prices & Demand',
            desc: 'Query spot prices, demand trends, and volatility periods across all regions.',
          },
          {
            title: 'Generation & Fuel Mix',
            desc: 'Analyse generation by fuel type, renewable penetration, and dispatch patterns.',
          },
          {
            title: 'Interconnectors & Constraints',
            desc: 'Explore flow patterns, binding constraints, and cross-regional arbitrage.',
          },
        ].map(item => (
          <div key={item.title} className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">{item.title}</h4>
            <p className="text-xs text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Genie page
// ---------------------------------------------------------------------------

export default function Genie() {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const sendPresetQuery = (query: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'genie_query', query },
      '*'
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-500" />
            <h2 className="text-xl font-bold text-gray-900">Genie Analytics</h2>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Natural language analytics over NEM prices, generation, and interconnectors
          </p>
        </div>
        {IFRAME_URL && (
          <a
            href={IFRAME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 shrink-0"
          >
            Open in Databricks
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Genie info box — always visible */}
      <div className="px-6 py-3 border-b border-gray-200 bg-purple-50/60 shrink-0">
        <div className="flex items-start gap-2 max-w-4xl">
          <Info size={14} className="text-purple-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold text-purple-700">Genie</span> allows natural language
            queries directly against your NEM data in Unity Catalog using AI-powered SQL
            generation.
          </p>
        </div>
      </div>

      {/* Preset query buttons */}
      {IFRAME_URL && (
        <div className="px-6 py-3 border-b border-gray-100 bg-white shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 mr-1 shrink-0">Quick queries:</span>
            {PRESET_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => sendPresetQuery(q)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-colors"
              >
                <Send size={11} />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0">
        {IFRAME_URL ? (
          <iframe
            ref={iframeRef}
            src={IFRAME_URL}
            title="Databricks Genie Analytics"
            className="w-full h-full border-0"
            allow="clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        ) : (
          <SetupPanel />
        )}
      </div>
    </div>
  )
}
