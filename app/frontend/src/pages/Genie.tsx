import { Sparkles, ExternalLink } from 'lucide-react'

const GENIE_URL: string = (import.meta as Record<string, unknown> & { env: Record<string, string> }).env.VITE_GENIE_URL ?? ''

export default function Genie() {
  return (
    <div className="h-full flex flex-col">
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
        {GENIE_URL && (
          <a
            href={GENIE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
          >
            Open in Databricks
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {GENIE_URL ? (
          <iframe
            src={GENIE_URL}
            title="Databricks Genie Analytics"
            className="w-full h-full border-0"
            allow="clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-gray-500">
            <Sparkles size={48} className="text-purple-200 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Genie Space Not Configured</h3>
            <p className="text-sm max-w-md">
              Set the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">VITE_GENIE_URL</code> environment
              variable to your Databricks Genie Space URL to embed the analytics interface here.
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Example: <span className="font-mono">VITE_GENIE_URL=https://&lt;workspace&gt;.azuredatabricks.net/genie/spaces/&lt;space-id&gt;</span>
            </p>

            {/* Placeholder feature list */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl text-left">
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
        )}
      </div>
    </div>
  )
}
